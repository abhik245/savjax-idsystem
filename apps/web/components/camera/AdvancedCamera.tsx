"use client";

/**
 * AdvancedCamera — AI-guided face capture
 *
 * StudioGrade v3, task 1:
 * ─ Captures at the device's actual sensor resolution (ImageCapture.takePhoto()
 *   where supported, else the highest negotiated getUserMedia track size) —
 *   no more hard-resize to a fixed 720×960 canvas.
 * ─ Uploads the full, uncropped frame — server-side framing is a later step.
 * ─ Defaults to the rear camera (front cameras on budget Android devices are
 *   dramatically worse for this use case).
 * ─ Real face detection via MediaPipe FaceLandmarker (WASM, served locally
 *   from /public/mediapipe — not a CDN). There is NO heuristic fallback: if
 *   the model fails to load, capture is disabled and an error is shown. A
 *   detector that can pass a keyboard is worse than no detector at all.
 * ─ All checks are derived from the 478 landmarks, not pixel brightness on a
 *   fixed sample rectangle: exactly-one-face gate (min detection confidence
 *   0.7), pose from the facial transformation matrix (±15° yaw / ±12° pitch
 *   / ±10° roll), eyes-open via eye-aspect-ratio on the eyelid landmarks,
 *   light/sharpness/highlight-clipping sampled only inside the face-oval
 *   landmark hull (not the whole frame), and stillness from landmark
 *   centroid variance across the last 5 frames.
 * ─ Same guidance cadence, hold-steady auto-capture, and visual design as
 *   before.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, FlipHorizontal2, RefreshCw, X, CheckCircle2, AlertCircle, Zap, ZapOff } from "lucide-react";
import type { FaceLandmarker as FaceLandmarkerType, FilesetResolver as FilesetResolverType } from "@mediapipe/tasks-vision";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CaptureResult = {
  dataUrl: string;
  width: number;
  height: number;
  qualityScore: number;
  /** Achieved capture resolution + how it was obtained — logged for the
   *  step-1 measurement deliverable; not yet persisted server-side. */
  captureMeta: {
    method: "image-capture" | "video-frame";
    trackSettings: { width?: number; height?: number; facingMode?: string } | null;
  };
};

type Quality = {
  face: boolean;
  singleFace: boolean;
  light: boolean;
  sharp: boolean;
  still: boolean;
  centered: boolean;
  distance: boolean;
  eyesOpen: boolean;
  poseOk: boolean;
  highlightsOk: boolean;
  score: number; // 0–100
  message: string;
};

type Props = {
  onCapture: (result: CaptureResult) => void;
  onCancel?: () => void;
  captureWidth?: number;
  captureHeight?: number;
};

// ── Constants ─────────────────────────────────────────────────────────────────

// Preview/analysis target — the *analysis* loop still runs at a modest size
// for perf; this is NOT the capture resolution any more.
const PREVIEW_W = 720;
const PREVIEW_H = 960;
const STABLE_NEEDED = 24; // ~3 s at 8 fps analysis
const ANALYSIS_INTERVAL_MS = 125; // 8 fps
const OVAL_W = 0.58; // fraction of video width
const OVAL_H = 0.74; // fraction of video height
const MAX_YAW_DEG = 15;
const MAX_PITCH_DEG = 12;
const MAX_ROLL_DEG = 10;
const HIGHLIGHT_CLIP_LIMIT = 0.12; // >12% of face-hull pixels near-white → flag
const EAR_CLOSED_THRESHOLD = 0.2; // eye-aspect-ratio below this = eyes closed
const CENTROID_HISTORY_LEN = 5;
const CENTROID_STILL_VARIANCE_LIMIT = 4; // px^2, on a ~720-wide analysis frame
const MIN_FACE_DETECTION_CONFIDENCE = 0.7;

// MediaPipe's published FACEMESH_FACE_OVAL index set — the boundary contour
// used to build the face-hull polygon that light/sharpness/highlight
// sampling is restricted to (never the whole frame, never a fixed rectangle
// that can be centered on background instead of a face).
const FACE_OVAL_INDICES = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150,
  136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
];

// Standard 6-point eye contour subsets (outer corner, 2x upper lid, inner
// corner, 2x lower lid) used for the Soukupová & Čech eye-aspect-ratio.
const RIGHT_EYE_EAR_INDICES = [33, 160, 158, 133, 153, 144];
const LEFT_EYE_EAR_INDICES = [362, 385, 387, 263, 373, 380];

const DEFAULT_QUALITY: Quality = {
  face: false,
  singleFace: true,
  light: false,
  sharp: false,
  still: false,
  centered: false,
  distance: false,
  eyesOpen: false,
  poseOk: false,
  highlightsOk: true,
  score: 0,
  message: "Starting camera…"
};

// ── MediaPipe FaceLandmarker — lazy singleton, loaded from local assets ──────

let landmarkerPromise: Promise<FaceLandmarkerType> | null = null;

function getFaceLandmarker(): Promise<FaceLandmarkerType> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FaceLandmarker, FilesetResolver } = (await import("@mediapipe/tasks-vision")) as {
        FaceLandmarker: typeof FaceLandmarkerType;
        FilesetResolver: typeof FilesetResolverType;
      };
      const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: "/mediapipe/face_landmarker.task",
          // CPU delegate: slower than GPU but far more reliably available
          // across Safari/iOS and older Android WebViews. A detector that
          // silently fails to init on some devices (a known GPU-delegate
          // risk) is exactly the failure mode this rewrite exists to remove.
          delegate: "CPU"
        },
        runningMode: "VIDEO",
        numFaces: 2, // detect up to 2 so we can flag "multiple faces" rather than just picking one
        minFaceDetectionConfidence: MIN_FACE_DETECTION_CONFIDENCE,
        minFacePresenceConfidence: MIN_FACE_DETECTION_CONFIDENCE,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: true
      });
    })();
  }
  return landmarkerPromise;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdvancedCamera({
  onCapture,
  onCancel,
  captureWidth = PREVIEW_W,
  captureHeight = PREVIEW_H
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const captureRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const imageCaptureRef = useRef<any>(null);
  const rafRef = useRef(0);
  const stableRef = useRef(0);
  const capturedRef = useRef(false);
  const lastAnalysisRef = useRef(0);
  const landmarkerRef = useRef<FaceLandmarkerType | null>(null);
  const landmarkerStatusRef = useRef<"loading" | "ready" | "error">("loading");
  const centroidHistoryRef = useRef<Array<{ x: number; y: number }>>([]);

  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [achievedResolution, setAchievedResolution] = useState<{ width: number; height: number } | null>(null);
  const [quality, setQuality] = useState<Quality>(DEFAULT_QUALITY);
  // No heuristic fallback exists — while "loading", capture stays disabled;
  // on "error", capture stays disabled and an explicit error is shown.
  const [landmarkerStatus, setLandmarkerStatus] = useState<"loading" | "ready" | "error">("loading");

  // ── MediaPipe warm-up (starts loading as soon as the component mounts) ───

  useEffect(() => {
    getFaceLandmarker()
      .then((lm) => {
        landmarkerRef.current = lm;
        landmarkerStatusRef.current = "ready";
        setLandmarkerStatus("ready");
      })
      .catch((e) => {
        landmarkerStatusRef.current = "error";
        setLandmarkerStatus("error");
        // eslint-disable-next-line no-console
        console.error("MediaPipe FaceLandmarker failed to load. Capture is disabled — there is no fallback detector.", e);
      });
  }, []);

  // ── Camera start / stop ───────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    imageCaptureRef.current = null;
    stableRef.current = 0;
    capturedRef.current = false;
    centroidHistoryRef.current = [];
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

  const startCamera = useCallback(
    async (facingMode: "user" | "environment") => {
      stopCamera();
      setError(null);
      setAchievedResolution(null);
      setQuality((q) => ({ ...q, message: "Starting camera…" }));
      try {
        // Request the highest resolution the device sensor can give us — the
        // browser will pick the closest supported mode. Portrait-biased ideal
        // since ID photos are portrait; capture itself does not force-crop.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 4096 },
            height: { ideal: 3072 },
            frameRate: { ideal: 30 }
          },
          audio: false
        });
        streamRef.current = stream;

        const track = stream.getVideoTracks()[0];
        const settings = track?.getSettings?.() || {};
        setAchievedResolution(
          settings.width && settings.height ? { width: settings.width, height: settings.height } : null
        );
        // eslint-disable-next-line no-console
        console.info("[AdvancedCamera] getUserMedia track settings:", settings);

        if ("ImageCapture" in window && track) {
          try {
            imageCaptureRef.current = new (window as any).ImageCapture(track);
          } catch {
            imageCaptureRef.current = null;
          }
        }

        const caps = track?.getCapabilities?.() as Record<string, unknown> | undefined;
        const hasTorch = !!(caps && "torch" in caps);
        setTorchSupported(hasTorch);
        setTorchOn(false);
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        setReady(true);
      } catch (e) {
        const err =
          e instanceof DOMException
            ? e.name === "NotAllowedError"
              ? "Camera permission denied. Please allow camera access."
              : e.name === "NotFoundError"
                ? "No camera found on this device."
                : "Could not start camera."
            : "Could not start camera.";
        setError(err);
      }
    },
    [stopCamera]
  );

  useEffect(() => {
    startCamera(facing);
    return stopCamera;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing]);

  // ── Capture — at native/achieved resolution, full frame, no forced crop ──

  const doCapture = useCallback(async () => {
    if (capturedRef.current) return;
    capturedRef.current = true;
    setFlash(true);
    setTimeout(() => setFlash(false), 250);

    const v = videoRef.current!;
    const c = captureRef.current!;
    const track = streamRef.current?.getVideoTracks()[0];
    const settings = track?.getSettings?.() || {};
    const mirror = facing === "user";

    let dataUrl: string;
    let outW: number;
    let outH: number;
    let method: CaptureResult["captureMeta"]["method"] = "video-frame";

    // Prefer ImageCapture.takePhoto() — gives the full sensor still, not just
    // the preview stream's frame.
    if (imageCaptureRef.current) {
      try {
        const blob: Blob = await imageCaptureRef.current.takePhoto();
        const bitmap = await createImageBitmap(blob);
        outW = bitmap.width;
        outH = bitmap.height;
        c.width = outW;
        c.height = outH;
        const ctx = c.getContext("2d")!;
        if (mirror) {
          ctx.save();
          ctx.scale(-1, 1);
          ctx.drawImage(bitmap, -outW, 0, outW, outH);
          ctx.restore();
        } else {
          ctx.drawImage(bitmap, 0, 0, outW, outH);
        }
        dataUrl = c.toDataURL("image/jpeg", 0.97);
        method = "image-capture";
        bitmap.close?.();
        stopCamera();
        onCapture({
          dataUrl,
          width: outW,
          height: outH,
          qualityScore: quality.score,
          captureMeta: { method, trackSettings: settings }
        });
        // eslint-disable-next-line no-console
        console.info(`[AdvancedCamera] Captured via ImageCapture at ${outW}x${outH}`);
        return;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[AdvancedCamera] ImageCapture.takePhoto() failed, falling back to video frame.", e);
      }
    }

    // Fallback: grab the current frame at the *actual negotiated* stream
    // resolution (not a fixed 720x960 canvas).
    outW = v.videoWidth || settings.width || captureWidth;
    outH = v.videoHeight || settings.height || captureHeight;
    c.width = outW;
    c.height = outH;
    const ctx = c.getContext("2d")!;
    if (mirror) {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(v, -outW, 0, outW, outH);
      ctx.restore();
    } else {
      ctx.drawImage(v, 0, 0, outW, outH);
    }
    dataUrl = c.toDataURL("image/jpeg", 0.97);
    stopCamera();
    onCapture({
      dataUrl,
      width: outW,
      height: outH,
      qualityScore: quality.score,
      captureMeta: { method, trackSettings: settings }
    });
    // eslint-disable-next-line no-console
    console.info(`[AdvancedCamera] Captured via video frame at ${outW}x${outH}`);
  }, [captureWidth, captureHeight, onCapture, stopCamera, quality.score, facing]);

  // ── Analysis + overlay render loop ────────────────────────────────────────

  useEffect(() => {
    if (!ready) return;

    const video = videoRef.current!;
    const overlay = overlayRef.current!;
    const ctx = overlay.getContext("2d", { willReadFrequently: true })!;
    let animating = true;
    const mirror = facing === "user";

    function loop(ts: number) {
      if (!animating) return;
      rafRef.current = requestAnimationFrame(loop);
      if (video.readyState < 2) return;

      if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) {
        overlay.width = video.videoWidth || 640;
        overlay.height = video.videoHeight || 480;
      }
      const W = overlay.width;
      const H = overlay.height;

      ctx.save();
      if (mirror) {
        ctx.scale(-1, 1);
        ctx.drawImage(video, -W, 0, W, H);
      } else {
        ctx.drawImage(video, 0, 0, W, H);
      }
      ctx.restore();

      if (ts - lastAnalysisRef.current < ANALYSIS_INTERVAL_MS) {
        drawOverlay(ctx, W, H, quality, stableRef.current);
        return;
      }
      lastAnalysisRef.current = ts;

      void runAnalysis(video, ctx, W, H, mirror);
    }

    async function runAnalysis(videoEl: HTMLVideoElement, overlayCtx: CanvasRenderingContext2D, W: number, H: number, isMirrored: boolean) {
      const oW = W * OVAL_W;
      const oH = H * OVAL_H;
      const oX = (W - oW) / 2;
      const oY = (H - oH) / 2;

      // Background uniformity — sample the four frame corners, well outside
      // the oval, independent of whether a face is even present.
      let backgroundOk = true;
      try {
        const bgVariance = sampleBackgroundVariance(overlayCtx, W, H);
        backgroundOk = bgVariance < 2600;
      } catch {
        backgroundOk = true;
      }

      // No landmarker available (still loading, or failed to load) — do NOT
      // fall through to any heuristic. Every check reads as not-passing, so
      // the stability gate (and the disabled capture button) simply never
      // lets a capture happen.
      if (landmarkerRef.current === null) {
        setQuality({
          ...DEFAULT_QUALITY,
          message:
            landmarkerStatusRef.current === "error" ? "Face detection failed to load. Capture disabled." : "Loading face detection…"
        });
        stableRef.current = 0;
        setCountdown(null);
        drawOverlay(overlayCtx, W, H, DEFAULT_QUALITY, 0);
        return;
      }

      let landmarkResult: ReturnType<FaceLandmarkerType["detectForVideo"]> | null = null;
      try {
        landmarkResult = landmarkerRef.current.detectForVideo(videoEl, performance.now());
      } catch (e) {
        // Transient per-frame failure: treat as "no face detected" for this
        // frame only (safe/red), never as a pass.
        // eslint-disable-next-line no-console
        console.warn("[AdvancedCamera] detectForVideo failed for this frame", e);
        landmarkResult = null;
      }

      const newQ = evaluateLandmarks(
        landmarkResult,
        W,
        H,
        isMirrored,
        oX,
        oY,
        oW,
        oH,
        backgroundOk,
        overlayCtx,
        stableRef.current,
        centroidHistoryRef.current
      );

      setQuality(newQ);

      const allGood =
        newQ.face &&
        newQ.singleFace &&
        newQ.light &&
        newQ.sharp &&
        newQ.still &&
        newQ.centered &&
        newQ.distance &&
        newQ.eyesOpen &&
        newQ.poseOk &&
        newQ.highlightsOk;

      if (allGood) {
        stableRef.current++;
        setCountdown(Math.max(1, Math.ceil((STABLE_NEEDED - stableRef.current) / (1000 / ANALYSIS_INTERVAL_MS))));
      } else {
        stableRef.current = 0;
        setCountdown(null);
      }

      if (stableRef.current >= STABLE_NEEDED && !capturedRef.current) void doCapture();

      drawOverlay(overlayCtx, W, H, newQ, stableRef.current);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      animating = false;
      cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, doCapture, facing]);

  // ── Overlay painter (pure canvas) ─────────────────────────────────────────

  function drawOverlay(ctx: CanvasRenderingContext2D, W: number, H: number, q: Quality, stable: number) {
    const oW = W * OVAL_W;
    const oH = H * OVAL_H;
    const cx = W / 2;
    const cy = H / 2;
    const rx = oW / 2;
    const ry = oH / 2;
    const allGood =
      q.face && q.singleFace && q.light && q.sharp && q.still && q.centered && q.distance && q.eyesOpen && q.poseOk && q.highlightsOk;
    const progress = stable / STABLE_NEEDED;
    const ringColor = allGood ? "#22c55e" : "#f59e0b";
    const glowColor = allGood ? "rgba(34,197,94,0.5)" : "rgba(245,158,11,0.35)";

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2, true);
    ctx.clip("evenodd");
    ctx.fillStyle = "rgba(0,0,0,0.68)";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 20;
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx + 2, ry + 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (allGood && progress > 0) {
      ctx.save();
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 5;
      ctx.shadowColor = "rgba(34,197,94,0.8)";
      ctx.shadowBlur = 14;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, ry / rx);
      ctx.beginPath();
      ctx.arc(0, 0, rx + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();
      ctx.restore();
      ctx.restore();
    }

    const bLen = Math.min(W, H) * 0.045;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 3;
    const corners = [
      { x: cx - rx, y: cy - ry, dx: 1, dy: 1 },
      { x: cx + rx, y: cy - ry, dx: -1, dy: 1 },
      { x: cx - rx, y: cy + ry, dx: 1, dy: -1 },
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

    const labelY = cy - ry + ry * 0.16;
    ctx.font = `600 ${Math.round(H * 0.022)}px -apple-system, sans-serif`;
    ctx.textAlign = "center";
    const labelText = allGood ? "✓ Perfect — hold still!" : "Align face inside the oval";
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillText(labelText, cx + 1, labelY + 1);
    ctx.fillStyle = allGood ? "#4ade80" : "rgba(255,255,255,0.92)";
    ctx.fillText(labelText, cx, labelY);

    ctx.restore();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const allGood =
    quality.face &&
    quality.singleFace &&
    quality.light &&
    quality.sharp &&
    quality.still &&
    quality.centered &&
    quality.distance &&
    quality.eyesOpen &&
    quality.poseOk &&
    quality.highlightsOk;

  const INDICATORS = [
    { key: "face", label: "Face", ok: quality.face && quality.singleFace },
    { key: "pose", label: "Pose", ok: quality.centered && quality.distance && quality.poseOk },
    { key: "eyes", label: "Eyes", ok: quality.eyesOpen },
    { key: "light", label: "Light", ok: quality.light && quality.highlightsOk },
    { key: "sharp", label: "Sharp", ok: quality.sharp },
    { key: "still", label: "Still", ok: quality.still }
  ] as const;

  return (
    <div className="flex flex-col items-center gap-4 select-none w-full">
      {/* ── Viewport ── */}
      <div
        className="relative w-full overflow-hidden rounded-3xl bg-black shadow-2xl"
        style={{ aspectRatio: "3/4", maxWidth: 420 }}
      >
        <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover opacity-0" aria-hidden="true" />

        <canvas ref={overlayRef} className="absolute inset-0 w-full h-full" style={{ objectFit: "cover" }} aria-hidden="true" />

        {flash && <div className="absolute inset-0 bg-white rounded-3xl animate-flash-out pointer-events-none" />}

        {countdown !== null && (
          <div
            className="absolute bottom-6 left-1/2 -translate-x-1/2
                       w-16 h-16 rounded-full bg-green-500/90 backdrop-blur
                       flex items-center justify-center shadow-xl shadow-green-500/40 z-10
                       animate-scale-in"
          >
            <span className="text-white text-3xl font-bold tabular-nums">{countdown}</span>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 backdrop-blur p-6 text-center rounded-3xl z-20">
            <AlertCircle className="text-red-400 w-10 h-10" />
            <p className="text-white text-sm leading-relaxed">{error}</p>
            <button
              onClick={() => startCamera(facing)}
              className="mt-1 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition"
            >
              Try Again
            </button>
          </div>
        )}

        {!error && landmarkerStatus === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 backdrop-blur p-6 text-center rounded-3xl z-20">
            <AlertCircle className="text-red-400 w-10 h-10" />
            <p className="text-white text-sm leading-relaxed">
              Face detection failed to load. Capture is disabled — check your connection and try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-1 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition"
            >
              Reload
            </button>
          </div>
        )}

        <div className="absolute top-3 right-3 flex gap-2 z-10">
          {facing === "environment" && torchSupported && (
            <button
              onClick={() => void toggleTorch()}
              aria-label={torchOn ? "Turn off flash" : "Turn on flash"}
              className={`p-2.5 rounded-full backdrop-blur transition border text-white
                ${torchOn ? "bg-amber-500/80 border-amber-400/60 shadow-lg shadow-amber-500/40" : "bg-black/50 border-white/10 hover:bg-black/70"}`}
            >
              {torchOn ? <Zap className="w-4 h-4 fill-white" /> : <ZapOff className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
            aria-label="Flip camera"
            className="p-2.5 rounded-full bg-black/50 backdrop-blur hover:bg-black/70 text-white transition border border-white/10"
          >
            <FlipHorizontal2 className="w-4 h-4" />
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              aria-label="Cancel"
              className="p-2.5 rounded-full bg-black/50 backdrop-blur hover:bg-black/70 text-white transition border border-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <canvas ref={captureRef} className="hidden" aria-hidden="true" />

      {facing === "user" && (
        <p className="text-[11px] text-amber-300 text-center max-w-xs -mt-2">
          Front camera quality is often much lower. For the best ID photo, flip to the rear camera — or have someone else take the photo.
        </p>
      )}

      {achievedResolution && (
        <p className="text-[10px] text-gray-500 text-center -mt-1">
          Camera resolution: {achievedResolution.width}×{achievedResolution.height}
        </p>
      )}

      <div className="grid grid-cols-6 gap-1.5 w-full max-w-sm">
        {INDICATORS.map(({ key, label, ok }) => (
          <div
            key={key}
            className={`flex flex-col items-center gap-1 py-2 rounded-2xl border text-[10px] font-semibold
              transition-all duration-300
              ${ok ? "bg-green-500/15 border-green-500/40 text-green-400 scale-105" : "bg-white/5 border-white/10 text-gray-500 scale-100"}`}
          >
            {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5 rounded-full border-2 border-current" />}
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="w-full max-w-sm space-y-1.5">
        <div className="flex justify-between text-xs text-gray-400 px-0.5">
          <span>Photo quality</span>
          <span className={allGood ? "text-green-400 font-semibold" : "text-amber-400"}>{quality.score}%</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-[width] duration-400 ease-out ${allGood ? "bg-green-500" : "bg-amber-400"}`}
            style={{ width: `${quality.score}%` }}
          />
        </div>
      </div>

      <p
        className={`text-sm font-medium text-center transition-colors duration-200 ${allGood ? "text-green-400" : "text-amber-300"}`}
        role="status"
        aria-live="polite"
      >
        {quality.message}
      </p>

      <div className="flex gap-3 w-full max-w-sm">
        <button
          onClick={() => {
            if (ready && landmarkerStatus === "ready") void doCapture();
          }}
          disabled={!ready || landmarkerStatus !== "ready"}
          className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl
            font-semibold text-sm transition-all shadow-lg active:scale-95
            ${
              !ready || landmarkerStatus !== "ready"
                ? "bg-white/10 text-gray-500 cursor-not-allowed"
                : allGood
                  ? "bg-green-500 hover:bg-green-400 text-white shadow-green-500/30"
                  : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30"
            }`}
        >
          <Camera className="w-4 h-4" />
          {landmarkerStatus === "loading" ? "Loading…" : landmarkerStatus === "error" ? "Unavailable" : allGood ? "Capture Now" : "Capture"}
        </button>

        <button
          onClick={() => startCamera(facing)}
          aria-label="Restart camera"
          className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-gray-300 transition border border-white/10"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-gray-500 text-center max-w-xs leading-relaxed">
        Auto-captures in <strong className="text-gray-400">3 seconds</strong> once your face is centred, lit, sharp and still. Or tap{" "}
        <strong className="text-gray-400">Capture</strong> manually.
      </p>
    </div>
  );
}

// ── Landmark-based analysis ──────────────────────────────────────────────────

function evaluateLandmarks(
  result: {
    faceLandmarks: Array<Array<{ x: number; y: number; z: number }>>;
    facialTransformationMatrixes?: Array<{ data: Float32Array | number[] }>;
  } | null,
  W: number,
  H: number,
  mirrored: boolean,
  oX: number,
  oY: number,
  oW: number,
  oH: number,
  backgroundOk: boolean,
  ctx: CanvasRenderingContext2D,
  stableCount: number,
  centroidHistory: Array<{ x: number; y: number }>
): Quality {
  const faces = result?.faceLandmarks || [];
  const singleFace = faces.length === 1;
  const face = faces.length >= 1;

  if (!face || !singleFace) {
    // Zero faces, or more than one — both are a hard "not ready" state, not
    // a partial pass. Clear stillness history so we don't average across a
    // gap where nothing was tracked.
    centroidHistory.length = 0;
    return {
      ...DEFAULT_QUALITY,
      message: faces.length > 1 ? "Only one person should be in frame." : "Face not detected. Move the face into the oval."
    };
  }

  const points = faces[0];
  // Landmarks are normalized 0-1 relative to the frame handed to the
  // detector, which is the same video frame drawn (possibly mirrored) onto
  // the overlay canvas — so map them the same way.
  const mapX = (nx: number) => (mirrored ? (1 - nx) * W : nx * W);
  const mapY = (ny: number) => ny * H;

  // Face-oval hull polygon (mapped points) — light/sharpness/highlight
  // sampling is restricted to inside this polygon, never a fixed rectangle
  // that could be centred on background instead of a face.
  const hull = FACE_OVAL_INDICES.map((idx) => {
    const p = points[idx];
    return { x: mapX(p.x), y: mapY(p.y) };
  });

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of hull) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const faceW = maxX - minX;
  const faceH = maxY - minY;
  const faceCx = minX + faceW / 2;
  const faceCy = minY + faceH / 2;
  const ovalCx = oX + oW / 2;
  const ovalCy = oY + oH / 2;

  const centered = Math.abs(faceCx - ovalCx) < oW * 0.18 && Math.abs(faceCy - ovalCy) < oH * 0.18;
  const heightFraction = faceH / oH;
  const distance = heightFraction > 0.45 && heightFraction < 0.95;

  // Eyes-open via eye-aspect-ratio (Soukupová & Čech) on the eyelid landmarks.
  const earLeft = eyeAspectRatio(points, LEFT_EYE_EAR_INDICES, mapX, mapY);
  const earRight = eyeAspectRatio(points, RIGHT_EYE_EAR_INDICES, mapX, mapY);
  const eyesOpen = earLeft > EAR_CLOSED_THRESHOLD && earRight > EAR_CLOSED_THRESHOLD;

  // Head pose from the facial transformation matrix.
  let poseOk = false;
  const matrix = result?.facialTransformationMatrixes?.[0]?.data;
  if (matrix && matrix.length >= 16) {
    const { yaw, pitch, roll } = eulerAnglesFromMatrix(matrix);
    poseOk = Math.abs(yaw) <= MAX_YAW_DEG && Math.abs(pitch) <= MAX_PITCH_DEG && Math.abs(roll) <= MAX_ROLL_DEG;
  }

  // Light / sharpness / highlight-clipping — sampled only inside the face
  // hull polygon, cropped to its bounding box.
  const fx = Math.max(0, Math.floor(minX));
  const fy = Math.max(0, Math.floor(minY));
  const fw = Math.min(W - fx, Math.ceil(faceW));
  const fh = Math.min(H - fy, Math.ceil(faceH));
  let light = false;
  let sharp = false;
  let highlightsOk = true;
  if (fw > 4 && fh > 4) {
    try {
      const hullMetrics = sampleFaceHullMetrics(ctx, fx, fy, fw, fh, hull);
      light = hullMetrics.avgLuma > 65 && hullMetrics.avgLuma < 225;
      sharp = hullMetrics.laplacianVariance > 60;
      highlightsOk = hullMetrics.clippedFraction < HIGHLIGHT_CLIP_LIMIT;
    } catch {
      // getImageData can throw on a tainted/cross-origin canvas; treat as
      // "can't tell" rather than a false pass.
      light = false;
      sharp = false;
      highlightsOk = true;
    }
  }

  // Stillness from landmark centroid variance across the last N frames —
  // tracks the actual face position, not generic frame noise.
  centroidHistory.push({ x: faceCx, y: faceCy });
  while (centroidHistory.length > CENTROID_HISTORY_LEN) centroidHistory.shift();
  let still = false;
  if (centroidHistory.length >= CENTROID_HISTORY_LEN) {
    const meanX = centroidHistory.reduce((s, p) => s + p.x, 0) / centroidHistory.length;
    const meanY = centroidHistory.reduce((s, p) => s + p.y, 0) / centroidHistory.length;
    const variance =
      centroidHistory.reduce((s, p) => s + (p.x - meanX) ** 2 + (p.y - meanY) ** 2, 0) / centroidHistory.length;
    still = variance < CENTROID_STILL_VARIANCE_LIMIT;
  }

  const allGood = light && sharp && still && centered && distance && eyesOpen && poseOk && highlightsOk && backgroundOk;
  const score =
    10 + // exactly one face, confirmed above
    10 + // single face
    (centered ? 15 : 0) +
    (distance ? 15 : 0) +
    (light ? 15 : 0) +
    (sharp ? 10 : 0) +
    (still ? 10 : 0) +
    (eyesOpen ? 10 : 0) +
    (poseOk ? 5 : 0);

  let message = "Position your face inside the oval";
  if (!centered) message = "Centre your face inside the oval.";
  else if (!distance) message = heightFraction <= 0.45 ? "Move a little closer." : "Move back a little.";
  else if (!poseOk) message = "Face the camera directly — don't tilt or turn your head.";
  else if (!light) message = "Lighting is uneven — move to brighter, even light.";
  else if (!highlightsOk) message = "Too much glare/backlight on the face — turn away from direct light.";
  else if (!sharp) message = "Hold steady — image looks blurry.";
  else if (!eyesOpen) message = "Eyes look closed — open your eyes.";
  else if (!backgroundOk) message = "Background is busy — plain background preferred, but you can continue.";
  else if (!still) message = "Hold still…";
  else {
    const secLeft = Math.ceil((STABLE_NEEDED - stableCount) / (1000 / ANALYSIS_INTERVAL_MS));
    message = secLeft > 0 ? `Hold still — capturing in ${secLeft}s` : "✓ Perfect!";
  }

  return {
    face,
    singleFace,
    light,
    sharp,
    still,
    centered,
    distance,
    eyesOpen,
    poseOk,
    highlightsOk: highlightsOk && backgroundOk,
    score,
    message
  };
}

/** Eye-aspect-ratio (Soukupová & Čech 2016) from a 6-point eyelid contour:
 *  [outer corner, upper-1, upper-2, inner corner, lower-2, lower-1]. Lower
 *  values mean the eye is more closed; ignores landmark z (depth). */
function eyeAspectRatio(
  points: Array<{ x: number; y: number }>,
  indices: number[],
  mapX: (n: number) => number,
  mapY: (n: number) => number
) {
  const p = indices.map((i) => ({ x: mapX(points[i].x), y: mapY(points[i].y) }));
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  const vertical = dist(p[1], p[5]) + dist(p[2], p[4]);
  const horizontal = dist(p[0], p[3]);
  if (horizontal < 1e-6) return 1; // degenerate — treat as open rather than a false "closed"
  return vertical / (2 * horizontal);
}

/** Decode yaw/pitch/roll (degrees) from MediaPipe's column-major 4x4
 *  facial transformation matrix. This is a best-effort UX signal (guidance
 *  only, bounded gate) — not a compliance-grade pose estimate. */
function eulerAnglesFromMatrix(m: Float32Array | number[]) {
  const m00 = m[0], m20 = m[2];
  const m01 = m[4], m11 = m[5], m21 = m[6];
  const m02 = m[8];

  const pitch = Math.asin(clamp(-m21, -1, 1));
  let yaw: number;
  let roll: number;
  if (Math.abs(m21) < 0.9999) {
    yaw = Math.atan2(m20, m[10]);
    roll = Math.atan2(m01, m11);
  } else {
    yaw = Math.atan2(-m02, m00);
    roll = 0;
  }
  const toDeg = 180 / Math.PI;
  return { yaw: yaw * toDeg, pitch: pitch * toDeg, roll: roll * toDeg };
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/** Point-in-polygon test (ray casting). */
function pointInPolygon(x: number, y: number, poly: Array<{ x: number; y: number }>) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Mean luma, Laplacian-variance sharpness, and highlight-clipping fraction,
 *  computed only over pixels inside the face-oval hull polygon within the
 *  given crop — never the whole frame, never a fixed rectangle. */
function sampleFaceHullMetrics(ctx: CanvasRenderingContext2D, fx: number, fy: number, fw: number, fh: number, hull: Array<{ x: number; y: number }>) {
  const data = ctx.getImageData(fx, fy, fw, fh).data;
  const luma = new Float32Array(fw * fh);
  const inside = new Uint8Array(fw * fh);

  let lumaSum = 0;
  let clipped = 0;
  let insideCount = 0;
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      const idx = y * fw + x;
      const isInside = pointInPolygon(fx + x, fy + y, hull);
      inside[idx] = isInside ? 1 : 0;
      if (!isInside) continue;
      const i = idx * 4;
      const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      luma[idx] = l;
      lumaSum += l;
      insideCount++;
      if (data[i] >= 250 && data[i + 1] >= 250 && data[i + 2] >= 250) clipped++;
    }
  }

  if (insideCount === 0) return { avgLuma: 0, laplacianVariance: 0, clippedFraction: 0 };

  const avgLuma = lumaSum / insideCount;

  // Laplacian variance (4-neighbour kernel), accumulated only for interior
  // pixels that are themselves inside the hull.
  let lapSum = 0;
  let lapSumSq = 0;
  let lapCount = 0;
  for (let y = 1; y < fh - 1; y++) {
    for (let x = 1; x < fw - 1; x++) {
      const idx = y * fw + x;
      if (!inside[idx]) continue;
      const lap = luma[idx - 1] + luma[idx + 1] + luma[idx - fw] + luma[idx + fw] - 4 * luma[idx];
      lapSum += lap;
      lapSumSq += lap * lap;
      lapCount++;
    }
  }
  const lapMean = lapCount ? lapSum / lapCount : 0;
  const laplacianVariance = lapCount ? lapSumSq / lapCount - lapMean * lapMean : 0;

  return { avgLuma, laplacianVariance, clippedFraction: clipped / insideCount };
}

/** Variance of luminance sampled from the four frame corners (outside the
 *  oval), as a rough "is the background plain" signal. */
function sampleBackgroundVariance(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const patch = Math.max(4, Math.round(Math.min(W, H) * 0.1));
  const corners = [
    { x: 0, y: 0 },
    { x: W - patch, y: 0 },
    { x: 0, y: H - patch },
    { x: W - patch, y: H - patch }
  ];
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (const { x, y } of corners) {
    const data = ctx.getImageData(Math.max(0, x), Math.max(0, y), patch, patch).data;
    for (let i = 0; i < data.length; i += 4) {
      const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sum += luma;
      sumSq += luma * luma;
      count++;
    }
  }
  if (!count) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}
