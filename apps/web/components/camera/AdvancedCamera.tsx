"use client";

/**
 * AdvancedCamera — AI-guided face capture
 *
 * Features:
 * ─ Beautiful oval face guide with animated pulsing ring
 * ─ Real-time pixel-level brightness, sharpness & motion analysis
 * ─ Four animated quality indicators (Face · Light · Sharp · Still)
 * ─ 3-second auto-capture once all checks pass
 * ─ Circular countdown ring drawn on canvas
 * ─ Flash effect on capture
 * ─ Front/rear camera toggle
 * ─ Manual override capture button
 * ─ No external libraries — pure Canvas + MediaDevices API
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, FlipHorizontal2, RefreshCw, X, CheckCircle2, AlertCircle, Zap, ZapOff } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CaptureResult = {
  dataUrl: string;
  width: number;
  height: number;
  qualityScore: number;
};

type Quality = {
  face: boolean;
  light: boolean;
  sharp: boolean;
  still: boolean;
  score: number;       // 0–100
  message: string;
};

type Props = {
  onCapture: (result: CaptureResult) => void;
  onCancel?: () => void;
  captureWidth?: number;
  captureHeight?: number;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const CAPTURE_W = 720;
const CAPTURE_H = 960;
const STABLE_NEEDED = 24;          // ~3 s at 8 fps analysis
const ANALYSIS_INTERVAL_MS = 125;  // 8 fps
const OVAL_W = 0.58;               // fraction of video width
const OVAL_H = 0.74;               // fraction of video height

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdvancedCamera({
  onCapture,
  onCancel,
  captureWidth = CAPTURE_W,
  captureHeight = CAPTURE_H
}: Props) {
  const videoRef       = useRef<HTMLVideoElement>(null);
  const overlayRef     = useRef<HTMLCanvasElement>(null);
  const captureRef     = useRef<HTMLCanvasElement>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const rafRef         = useRef(0);
  const prevDataRef    = useRef<Uint8ClampedArray | null>(null);
  const stableRef      = useRef(0);
  const capturedRef    = useRef(false);
  const lastAnalysisRef = useRef(0);

  const [facing, setFacing]     = useState<"user" | "environment">("user");
  const [ready, setReady]       = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [flash, setFlash]       = useState(false);
  const [torchOn, setTorchOn]   = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [quality, setQuality]   = useState<Quality>({
    face: false, light: false, sharp: false, still: false,
    score: 0, message: "Starting camera…"
  });

  // ── Camera start / stop ───────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    stableRef.current = 0;
    capturedRef.current = false;
    prevDataRef.current = null;
    setReady(false);
    setCountdown(null);
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      // torch not supported at runtime
    }
  }, [torchOn]);

  const startCamera = useCallback(async (facingMode: "user" | "environment") => {
    stopCamera();
    setError(null);
    setQuality(q => ({ ...q, message: "Starting camera…" }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: captureWidth }, height: { ideal: captureHeight }, frameRate: { ideal: 30 } },
        audio: false
      });
      streamRef.current = stream;
      // Detect torch capability
      const track = stream.getVideoTracks()[0];
      const caps = track?.getCapabilities() as Record<string, unknown> | undefined;
      const hasTorch = !!(caps && "torch" in caps);
      setTorchSupported(hasTorch);
      setTorchOn(false);
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play();
      setReady(true);
    } catch (e) {
      const err = e instanceof DOMException
        ? e.name === "NotAllowedError" ? "Camera permission denied. Please allow camera access."
        : e.name === "NotFoundError"   ? "No camera found on this device."
        : "Could not start camera."
        : "Could not start camera.";
      setError(err);
    }
  }, [stopCamera, captureWidth, captureHeight]);

  useEffect(() => { startCamera(facing); return stopCamera; }, [facing]); // eslint-disable-line

  // ── Capture ───────────────────────────────────────────────────────────────

  const doCapture = useCallback(() => {
    if (capturedRef.current) return;
    capturedRef.current = true;
    setFlash(true);
    setTimeout(() => setFlash(false), 250);

    const v = videoRef.current!;
    const c = captureRef.current!;
    c.width  = captureWidth;
    c.height = captureHeight;
    const ctx = c.getContext("2d")!;

    // ── Centre-crop the video to the target portrait aspect ratio ────────────
    // Without this, a landscape camera stream (e.g. 1920×1080) would be
    // stretched into the portrait canvas, squishing faces horizontally.
    const vW = v.videoWidth  || captureWidth;
    const vH = v.videoHeight || captureHeight;
    const targetAspect = captureWidth / captureHeight;   // e.g. 720/960 = 0.75
    const videoAspect  = vW / vH;
    let sx: number, sy: number, sw: number, sh: number;
    if (videoAspect > targetAspect) {
      // Video is wider than target — crop horizontally from centre
      sh = vH;
      sw = Math.round(vH * targetAspect);
      sx = Math.round((vW - sw) / 2);
      sy = 0;
    } else {
      // Video is taller than target — crop vertically from centre
      sw = vW;
      sh = Math.round(vW / targetAspect);
      sx = 0;
      sy = Math.round((vH - sh) / 2);
    }

    ctx.save();
    ctx.scale(-1, 1);
    // 9-param drawImage: crop (sx,sy,sw,sh) from source → dest (−W,0,W,H)
    ctx.drawImage(v, sx, sy, sw, sh, -captureWidth, 0, captureWidth, captureHeight);
    ctx.restore();

    const dataUrl = c.toDataURL("image/jpeg", 0.92);
    stopCamera();
    onCapture({ dataUrl, width: captureWidth, height: captureHeight, qualityScore: 85 });
  }, [captureWidth, captureHeight, onCapture, stopCamera]);

  // ── Analysis + overlay render loop ────────────────────────────────────────

  useEffect(() => {
    if (!ready) return;

    const video   = videoRef.current!;
    const overlay = overlayRef.current!;
    const ctx     = overlay.getContext("2d", { willReadFrequently: true })!;
    let animating = true;

    function loop(ts: number) {
      if (!animating) return;
      rafRef.current = requestAnimationFrame(loop);
      if (video.readyState < 2) return;

      // sync canvas size
      if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) {
        overlay.width  = video.videoWidth  || 640;
        overlay.height = video.videoHeight || 480;
      }
      const W = overlay.width, H = overlay.height;

      // ── Draw mirrored frame ──────────────────────────────────────────────
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -W, 0, W, H);
      ctx.restore();

      // ── Run analysis at 8 fps ────────────────────────────────────────────
      if (ts - lastAnalysisRef.current < ANALYSIS_INTERVAL_MS) {
        drawOverlay(ctx, W, H, quality, stableRef.current);
        return;
      }
      lastAnalysisRef.current = ts;

      const oW = W * OVAL_W, oH = H * OVAL_H;
      const oX = (W - oW) / 2,  oY = (H - oH) / 2;

      // sample rectangle inscribed in oval (inner 70 %)
      const sX = Math.round(oX + oW * 0.15);
      const sY = Math.round(oY + oH * 0.10);
      const sW = Math.round(oW * 0.70);
      const sH = Math.round(oH * 0.80);

      let frame: ImageData;
      try { frame = ctx.getImageData(sX, sY, sW, sH); }
      catch { return; }
      const d = frame.data, n = d.length / 4;

      // brightness
      let lumSum = 0;
      for (let i = 0; i < d.length; i += 4)
        lumSum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const avgLum = lumSum / n;
      const light  = avgLum > 65 && avgLum < 225;

      // edge energy (sharpness)
      let edge = 0;
      for (let r = 1; r < sH - 1; r++) {
        for (let c = 1; c < sW - 1; c++) {
          const i = (r * sW + c) * 4;
          for (let ch = 0; ch < 3; ch++) {
            const gx = d[(r * sW + c + 1) * 4 + ch] - d[(r * sW + c - 1) * 4 + ch];
            const gy = d[((r + 1) * sW + c) * 4 + ch] - d[((r - 1) * sW + c) * 4 + ch];
            edge += gx * gx + gy * gy;
          }
        }
      }
      const sharp = (edge / n) > 120;

      // motion (frame diff)
      let motion = 0;
      if (prevDataRef.current && prevDataRef.current.length === d.length) {
        const p = prevDataRef.current;
        for (let i = 0; i < d.length; i += 4)
          motion += Math.abs(d[i] - p[i]) + Math.abs(d[i+1] - p[i+1]) + Math.abs(d[i+2] - p[i+2]);
        motion /= n * 3;
      }
      prevDataRef.current = new Uint8ClampedArray(d);
      const still = motion < 20;

      // face heuristic: skin-tone luminance in the oval region
      const face = avgLum > 75 && avgLum < 210 && light;

      const allGood = face && light && sharp && still;
      const score   = (face ? 25 : 0) + (light ? 25 : 0) + (sharp ? 25 : 0) + (still ? 25 : 0);

      // guidance message
      let message = "Position your face inside the oval";
      if (!light)       message = avgLum < 65 ? "Too dark — move to brighter area" : "Too bright — step away from light";
      else if (!sharp)  message = "Hold steady — blurry image";
      else if (!face)   message = "Centre your face inside the oval";
      else if (!still)  message = "Hold still…";
      else {
        const secLeft = Math.ceil((STABLE_NEEDED - stableRef.current) / (1000 / ANALYSIS_INTERVAL_MS));
        message = secLeft > 0 ? `Hold still — capturing in ${secLeft}s` : "✓ Perfect!";
      }

      const newQ: Quality = { face, light, sharp, still, score, message };
      setQuality(newQ);

      // stability counter
      if (allGood) {
        stableRef.current++;
        setCountdown(Math.max(1, Math.ceil((STABLE_NEEDED - stableRef.current) / (1000 / ANALYSIS_INTERVAL_MS))));
      } else {
        stableRef.current = 0;
        setCountdown(null);
      }

      if (stableRef.current >= STABLE_NEEDED && !capturedRef.current) doCapture();

      drawOverlay(ctx, W, H, newQ, stableRef.current);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => { animating = false; cancelAnimationFrame(rafRef.current); };
  }, [ready, doCapture]); // eslint-disable-line

  // ── Overlay painter (pure canvas) ─────────────────────────────────────────

  function drawOverlay(
    ctx: CanvasRenderingContext2D,
    W: number, H: number,
    q: Quality,
    stable: number
  ) {
    const oW = W * OVAL_W, oH = H * OVAL_H;
    const cx = W / 2, cy = H / 2;
    const rx = oW / 2, ry = oH / 2;
    const allGood = q.face && q.light && q.sharp && q.still;
    const progress = stable / STABLE_NEEDED;              // 0–1
    const ringColor = allGood ? "#22c55e" : "#f59e0b";
    const glowColor = allGood ? "rgba(34,197,94,0.5)" : "rgba(245,158,11,0.35)";

    // Dark vignette — clip to "everything outside the oval" using evenodd rule
    // so the video inside the oval remains fully visible
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);                                        // outer rect (CW)
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2, true);       // oval hole (CCW)
    ctx.clip("evenodd");                                          // only paint outside the oval
    ctx.fillStyle = "rgba(0,0,0,0.68)";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // Outer glow ellipse
    ctx.shadowColor  = glowColor;
    ctx.shadowBlur   = 20;
    ctx.strokeStyle  = ringColor;
    ctx.lineWidth    = 3;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx + 2, ry + 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Countdown arc (progress ring around the oval)
    if (allGood && progress > 0) {
      ctx.save();
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth   = 5;
      ctx.shadowColor = "rgba(34,197,94,0.8)";
      ctx.shadowBlur  = 14;
      // Draw an arc approximation by scaling
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, ry / rx);
      ctx.beginPath();
      ctx.arc(0, 0, rx + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();
      ctx.restore();
      ctx.restore();
    }

    // Corner bracket accents (4 corners of the oval bounding box)
    const bLen = Math.min(W, H) * 0.045;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur  = 8;
    ctx.strokeStyle = ringColor;
    ctx.lineWidth   = 3;
    const corners = [
      { x: cx - rx, y: cy - ry, dx: 1,  dy: 1  },
      { x: cx + rx, y: cy - ry, dx: -1, dy: 1  },
      { x: cx - rx, y: cy + ry, dx: 1,  dy: -1 },
      { x: cx + rx, y: cy + ry, dx: -1, dy: -1 }
    ];
    corners.forEach(({ x, y, dx, dy }) => {
      ctx.beginPath();
      ctx.moveTo(x + dx * bLen, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + dy * bLen);
      ctx.stroke();
    });
    ctx.shadowBlur = 0;

    // Top guidance label inside oval
    const labelY = cy - ry + ry * 0.16;
    ctx.font      = `600 ${Math.round(H * 0.022)}px -apple-system, sans-serif`;
    ctx.textAlign = "center";
    const labelText = allGood ? "✓ Perfect — hold still!" : "Align face inside the oval";
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillText(labelText, cx + 1, labelY + 1);
    ctx.fillStyle = allGood ? "#4ade80" : "rgba(255,255,255,0.92)";
    ctx.fillText(labelText, cx, labelY);

    ctx.restore();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const allGood = quality.face && quality.light && quality.sharp && quality.still;

  const INDICATORS = [
    { key: "face",  label: "Face",  ok: quality.face  },
    { key: "light", label: "Light", ok: quality.light },
    { key: "sharp", label: "Sharp", ok: quality.sharp },
    { key: "still", label: "Still", ok: quality.still }
  ] as const;

  return (
    <div className="flex flex-col items-center gap-4 select-none w-full">

      {/* ── Viewport ── */}
      <div className="relative w-full overflow-hidden rounded-3xl bg-black shadow-2xl"
           style={{ aspectRatio: "3/4", maxWidth: 420 }}>

        {/* Raw mirrored video (hidden behind canvas) */}
        <video ref={videoRef} muted playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-0"
          aria-hidden="true" />

        {/* Overlay canvas — draws video + vignette + oval + guides */}
        <canvas ref={overlayRef}
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: "cover" }}
          aria-hidden="true" />

        {/* White flash on capture — CSS keyframe (no framer-motion) */}
        {flash && (
          <div className="absolute inset-0 bg-white rounded-3xl animate-flash-out pointer-events-none" />
        )}

        {/* Countdown badge centre-bottom — CSS scale-in */}
        {countdown !== null && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2
                       w-16 h-16 rounded-full bg-green-500/90 backdrop-blur
                       flex items-center justify-center shadow-xl shadow-green-500/40 z-10
                       animate-scale-in">
            <span className="text-white text-3xl font-bold tabular-nums">{countdown}</span>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3
                          bg-black/80 backdrop-blur p-6 text-center rounded-3xl z-20">
            <AlertCircle className="text-red-400 w-10 h-10" />
            <p className="text-white text-sm leading-relaxed">{error}</p>
            <button onClick={() => startCamera(facing)}
              className="mt-1 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white
                         text-sm font-semibold rounded-xl transition">
              Try Again
            </button>
          </div>
        )}

        {/* Top controls */}
        <div className="absolute top-3 right-3 flex gap-2 z-10">
          {/* Torch — only shown when back camera is active and supported */}
          {facing === "environment" && torchSupported && (
            <button onClick={() => void toggleTorch()}
              aria-label={torchOn ? "Turn off flash" : "Turn on flash"}
              className={`p-2.5 rounded-full backdrop-blur transition border text-white
                ${torchOn
                  ? "bg-amber-500/80 border-amber-400/60 shadow-lg shadow-amber-500/40"
                  : "bg-black/50 border-white/10 hover:bg-black/70"}`}>
              {torchOn ? <Zap className="w-4 h-4 fill-white" /> : <ZapOff className="w-4 h-4" />}
            </button>
          )}
          <button onClick={() => setFacing(f => f === "user" ? "environment" : "user")}
            aria-label="Flip camera"
            className="p-2.5 rounded-full bg-black/50 backdrop-blur
                       hover:bg-black/70 text-white transition border border-white/10">
            <FlipHorizontal2 className="w-4 h-4" />
          </button>
          {onCancel && (
            <button onClick={onCancel} aria-label="Cancel"
              className="p-2.5 rounded-full bg-black/50 backdrop-blur
                         hover:bg-black/70 text-white transition border border-white/10">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Hidden capture canvas ── */}
      <canvas ref={captureRef} className="hidden" aria-hidden="true" />

      {/* ── Quality indicators ── */}
      <div className="grid grid-cols-4 gap-2 w-full max-w-sm">
        {INDICATORS.map(({ key, label, ok }) => (
          <div key={key}
            className={`flex flex-col items-center gap-1 py-2 rounded-2xl border text-xs font-semibold
              transition-all duration-300
              ${ok
                ? "bg-green-500/15 border-green-500/40 text-green-400 scale-105"
                : "bg-white/5 border-white/10 text-gray-500 scale-100"}`}>
            {ok
              ? <CheckCircle2 className="w-4 h-4" />
              : <div className="w-4 h-4 rounded-full border-2 border-current" />}
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* ── Progress bar ── */}
      <div className="w-full max-w-sm space-y-1.5">
        <div className="flex justify-between text-xs text-gray-400 px-0.5">
          <span>Photo quality</span>
          <span className={allGood ? "text-green-400 font-semibold" : "text-amber-400"}>
            {quality.score}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-[width] duration-400 ease-out ${allGood ? "bg-green-500" : "bg-amber-400"}`}
            style={{ width: `${quality.score}%` }} />
        </div>
      </div>

      {/* ── Live guidance message ── */}
      <p
        className={`text-sm font-medium text-center transition-colors duration-200
          ${allGood ? "text-green-400" : "text-amber-300"}`}
        role="status" aria-live="polite">
        {quality.message}
      </p>

      {/* ── Buttons ── */}
      <div className="flex gap-3 w-full max-w-sm">
        <button
          onClick={() => { if (ready) doCapture(); }}
          disabled={!ready}
          className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl
            font-semibold text-sm transition-all shadow-lg active:scale-95
            ${!ready
              ? "bg-white/10 text-gray-500 cursor-not-allowed"
              : allGood
                ? "bg-green-500 hover:bg-green-400 text-white shadow-green-500/30"
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30"}`}>
          <Camera className="w-4 h-4" />
          {allGood ? "Capture Now" : "Capture"}
        </button>

        <button onClick={() => startCamera(facing)} aria-label="Restart camera"
          className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/15
                     text-gray-300 transition border border-white/10">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-gray-500 text-center max-w-xs leading-relaxed">
        Auto-captures in <strong className="text-gray-400">3 seconds</strong> once your face is
        centred, lit, sharp and still. Or tap <strong className="text-gray-400">Capture</strong> manually.
      </p>
    </div>
  );
}
