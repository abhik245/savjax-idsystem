"use client";

import { motion } from "framer-motion";
import { Camera, CheckCircle2, ChevronRight, Smartphone } from "lucide-react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type Step = "mobile" | "otp" | "details" | "camera" | "preview" | "done";

type LinkMeta = {
  token: string;
  className: string;
  section: string;
  photoBgPreference: string;
  school: { name: string; code: string };
};

type StudentDraft = {
  fullName: string;
  parentName: string;
  parentMobile: string;
  className: string;
  section: string;
  rollNumber: string;
  address: string;
};

type PhotoAnalysisState = {
  analysisId: string;
  photoKey: string;
  quality: {
    status: "PASSED" | "WARN" | "FAILED" | "NOT_CHECKED";
    score: number | null;
    warnings: string[];
  };
  campaign: {
    campaignName: string;
    photoBgPreference: string;
    institutionType: string;
  };
};

export default function ParentIntakePage() {
  return (
    <Suspense fallback={<ParentLoading />}>
      <ParentIntakeInner />
    </Suspense>
  );
}

function ParentIntakeInner() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api/v2";
  const exposeDevOtp = process.env.NEXT_PUBLIC_EXPOSE_DEV_OTP === "true";
  const search = useSearchParams();
  const tokenFromUrl = search?.get("token") || search?.get("intake_token") || "";

  const [step, setStep] = useState<Step>("mobile");
  const [linkMeta, setLinkMeta] = useState<LinkMeta | null>(null);
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [guidance, setGuidance] = useState("Allow camera access and keep face centered");
  const [savedSubmissions, setSavedSubmissions] = useState(0);

  const [draft, setDraft] = useState<StudentDraft>({
    fullName: "",
    parentName: "",
    parentMobile: "",
    className: "",
    section: "",
    rollNumber: "",
    address: ""
  });

  const [capturedDataUrl, setCapturedDataUrl] = useState("");
  const [photoAnalysis, setPhotoAnalysis] = useState<PhotoAnalysisState | null>(null);
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectorRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceBoxRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const analysisTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (tokenFromUrl) void loadLink(tokenFromUrl);
    return () => {
      stopCamera();
      if (analysisTimerRef.current) window.clearInterval(analysisTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenFromUrl]);

  const progress = useMemo(() => {
    const map: Record<Step, number> = { mobile: 16, otp: 32, details: 55, camera: 78, preview: 92, done: 100 };
    return map[step];
  }, [step]);

  async function loadLink(token: string) {
    try {
      const res = await fetch(`${apiBase}/intake-links/token/${encodeURIComponent(token)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Invalid intake link");
      setLinkMeta(data as LinkMeta);
      setDraft((p) => ({
        ...p,
        className: data.className === "ALL" ? "" : data.className,
        section: data.section === "ALL" ? "" : data.section
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load link");
    }
  }

  async function sendOtp() {
    setError("");
    setStatus("");
    try {
      const res = await fetch(`${apiBase}/auth/parent/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "OTP failed");
      setStatus(
        exposeDevOtp && data.devOtp
          ? `OTP sent for testing. Dev OTP: ${data.devOtp}`
          : "OTP sent successfully"
      );
      setStep("otp");
    } catch (e) {
      setError(e instanceof Error ? e.message : "OTP send failed");
    }
  }

  async function verifyOtp() {
    setError("");
    setStatus("");
    try {
      const res = await fetch(`${apiBase}/auth/parent/verify-otp`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, otp })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "OTP invalid");

      const meRes = await fetch(`${apiBase}/auth/me`, {
        method: "GET",
        credentials: "include"
      });
      const meData = await meRes.json().catch(() => ({}));
      if (!meRes.ok || meData?.user?.role !== "PARENT") {
        throw new Error("Parent session could not be established. Please retry OTP verification.");
      }

      localStorage.removeItem("parent_access_token");
      localStorage.removeItem("parent_refresh_token");
      setStatus("Mobile verified successfully");
      setDraft((p) => ({ ...p, parentMobile: mobile }));
      setStep("details");
    } catch (e) {
      setError(e instanceof Error ? e.message : "OTP verify failed");
    }
  }

  async function startCamera() {
    setError("");
    try {
      stopCamera();
      const constraints: MediaStreamConstraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "environment" },
        audio: false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const list = await navigator.mediaDevices.enumerateDevices();
      const cams = list.filter((d) => d.kind === "videoinput");
      setDevices(cams);
      if (!deviceId && cams[0]) setDeviceId(cams[0].deviceId);

      const FaceDetectorCtor = (window as any).FaceDetector;
      detectorRef.current = FaceDetectorCtor ? new FaceDetectorCtor({ fastMode: true, maxDetectedFaces: 1 }) : null;
      if (analysisTimerRef.current) window.clearInterval(analysisTimerRef.current);
      analysisTimerRef.current = window.setInterval(() => {
        void analyzeFrame();
      }, 600);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Camera access failed");
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  async function analyzeFrame() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    const brightness = estimateBrightness(video);
    let face: any = null;

    if (detectorRef.current) {
      try {
        const faces = await detectorRef.current.detect(video);
        face = faces?.[0]?.boundingBox || null;
      } catch {
        face = null;
      }
    }

    if (!face) {
      faceBoxRef.current = null;
      if (brightness < 65) setGuidance("Increase light. Face not detected.");
      else setGuidance("Move face into frame and keep head upright.");
      return;
    }

    faceBoxRef.current = {
      x: face.x,
      y: face.y,
      width: face.width,
      height: face.height
    };

    const cx = face.x + face.width / 2;
    const cy = face.y + face.height / 2;
    const dx = Math.abs(cx - video.videoWidth / 2);
    const dy = Math.abs(cy - video.videoHeight / 2);
    const areaRatio = (face.width * face.height) / (video.videoWidth * video.videoHeight);

    if (brightness < 65) {
      setGuidance("Lighting is low. Move to brighter area.");
      return;
    }
    if (dx > video.videoWidth * 0.16 || dy > video.videoHeight * 0.2) {
      setGuidance("Center your face in the frame.");
      return;
    }
    if (areaRatio < 0.08) {
      setGuidance("Move closer so face is clear.");
      return;
    }
    setGuidance("Face clear. Capture now.");
  }

  function estimateBrightness(video: HTMLVideoElement) {
    const c = document.createElement("canvas");
    c.width = 120;
    c.height = 80;
    const ctx = c.getContext("2d");
    if (!ctx) return 0;
    ctx.drawImage(video, 0, 0, c.width, c.height);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) {
      sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    }
    return sum / (d.length / 4);
  }

  async function capturePhoto() {
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas) return;

    canvas.width = 720;
    canvas.height = 960;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bgColor = resolveBgColor(linkMeta?.photoBgPreference || "NONE");
    if (bgColor !== "transparent") {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const face = faceBoxRef.current;
    if (face) {
      const marginX = face.width * 1.2;
      const marginY = face.height * 1.5;
      const sx = Math.max(0, face.x - marginX);
      const sy = Math.max(0, face.y - marginY);
      const sw = Math.min(video.videoWidth - sx, face.width + marginX * 2);
      const sh = Math.min(video.videoHeight - sy, face.height + marginY * 2);
      ctx.drawImage(video, sx, sy, sw, sh, 100, 80, canvas.width - 200, canvas.height - 140);
    } else {
      ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 60, 60, canvas.width - 120, canvas.height - 120);
    }

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setCapturedDataUrl(dataUrl);
    setPhotoAnalysis(null);
    stopCamera();
    setStep("preview");
    void analyzeCapturedPhoto(dataUrl);
  }

  async function analyzeCapturedPhoto(dataUrl: string) {
    setError("");
    setAnalyzingPhoto(true);
    try {
      if (!linkMeta?.token) throw new Error("Missing intake token");

      const res = await fetch(`${apiBase}/parent/photo/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          intakeToken: linkMeta.token,
          photoDataUrl: dataUrl
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Photo analysis failed");
      setPhotoAnalysis(data as PhotoAnalysisState);
      const label = data?.quality?.status || "DONE";
      const score = data?.quality?.score ?? "--";
      setStatus(`Photo quality ${label} (score ${score})`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Photo analysis failed");
    } finally {
      setAnalyzingPhoto(false);
    }
  }

  function resolveBgColor(mode: string) {
    const m = mode.toUpperCase();
    if (m === "WHITE") return "#ffffff";
    if (m === "LIGHT_BLUE") return "#d8e9ff";
    if (m === "LIGHT_GRAY") return "#e7e7e7";
    return "transparent";
  }

  async function submitStudent() {
    setError("");
    setStatus("");
    try {
      if (!linkMeta?.token) throw new Error("Missing intake token");
      if (!capturedDataUrl) throw new Error("Capture photo first");
      if (analyzingPhoto) throw new Error("Photo analysis in progress. Please wait.");

      const res = await fetch(`${apiBase}/parent/submissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          intakeToken: linkMeta.token,
          fullName: draft.fullName,
          parentName: draft.parentName,
          parentMobile: draft.parentMobile,
          className: draft.className,
          section: draft.section,
          rollNumber: draft.rollNumber,
          address: draft.address,
          photoAnalysisId: photoAnalysis?.analysisId,
          photoKey: photoAnalysis?.photoKey,
          photoDataUrl: photoAnalysis?.analysisId ? undefined : capturedDataUrl
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Submit failed");
      setSavedSubmissions((n) => n + 1);
      setStatus("Submitted successfully");
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    }
  }

  function resetForSibling() {
    setCapturedDataUrl("");
    setPhotoAnalysis(null);
    setDraft((p) => ({ ...p, fullName: "", rollNumber: "", address: "" }));
    setStep("details");
  }

  return (
    <main className="min-h-screen bg-[var(--bg-base)] px-3 py-4 text-[var(--text-primary)] md:px-8 md:py-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="m-0 text-lg font-semibold">Parent Intake Portal</p>
              <p className="m-0 text-xs text-[var(--text-muted)]">{linkMeta?.school?.name || "Secure student onboarding"}</p>
            </div>
            <span className="rounded-xl border border-[var(--line-soft)] px-3 py-1 text-[11px] text-[var(--text-muted)]">{savedSubmissions} submitted</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-[rgba(15,60,120,0.3)]">
            <motion.div className="h-2 rounded-full bg-[linear-gradient(90deg,#0F3C78,#1C6ED5)]" animate={{ width: `${progress}%` }} />
          </div>
        </div>

        {status ? <p className="text-xs text-emerald-300">{status}</p> : null}
        {error ? <p className="text-xs text-rose-300">{error}</p> : null}

        {step === "mobile" ? (
          <section className="glass rounded-2xl p-4">
            <p className="mb-2 text-sm font-semibold">Step 1: Mobile verification</p>
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <input value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit mobile" className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none" />
              <button onClick={sendOtp} className="rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-4 py-2 text-sm font-semibold">Send OTP</button>
            </div>
          </section>
        ) : null}

        {step === "otp" ? (
          <section className="glass rounded-2xl p-4">
            <p className="mb-2 text-sm font-semibold">Step 2: Enter OTP</p>
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit OTP" className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none" />
              <button onClick={verifyOtp} className="rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-4 py-2 text-sm font-semibold">Verify</button>
            </div>
          </section>
        ) : null}

        {step === "details" ? (
          <section className="glass rounded-2xl p-4">
            <p className="mb-3 text-sm font-semibold">Step 3: Student details</p>
            <div className="grid gap-2 md:grid-cols-2">
              <input value={draft.fullName} onChange={(e) => setDraft((p) => ({ ...p, fullName: e.target.value }))} placeholder="Student full name" className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none" />
              <input value={draft.parentName} onChange={(e) => setDraft((p) => ({ ...p, parentName: e.target.value }))} placeholder="Parent full name" className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none" />
              <input value={draft.parentMobile} onChange={(e) => setDraft((p) => ({ ...p, parentMobile: e.target.value.replace(/\D/g, "").slice(0, 10) }))} placeholder="Parent mobile" className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none" />
              <input value={draft.rollNumber} onChange={(e) => setDraft((p) => ({ ...p, rollNumber: e.target.value }))} placeholder="Roll number" className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none" />
              <input value={draft.className} onChange={(e) => setDraft((p) => ({ ...p, className: e.target.value.toUpperCase() }))} placeholder="Class" className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none" />
              <input value={draft.section} onChange={(e) => setDraft((p) => ({ ...p, section: e.target.value.toUpperCase() }))} placeholder="Section" className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none" />
              <textarea value={draft.address} onChange={(e) => setDraft((p) => ({ ...p, address: e.target.value }))} placeholder="Address" className="md:col-span-2 rounded-xl border border-[var(--line-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none" />
            </div>
            <button onClick={() => { setStep("camera"); void startCamera(); }} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-4 py-2 text-sm font-semibold"><ChevronRight size={14} /> Continue to camera</button>
          </section>
        ) : null}

        {step === "camera" ? (
          <section className="glass rounded-2xl p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Step 4: Capture photo</p>
              <span className="text-[11px] text-[var(--text-muted)]">Bg pref: {linkMeta?.photoBgPreference || "NONE"}</span>
            </div>
            <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
              <div>
                <video ref={videoRef} className="h-[420px] w-full rounded-2xl border border-[var(--line-soft)] bg-black object-cover" playsInline muted />
                <canvas ref={captureCanvasRef} className="hidden" />
              </div>
              <div className="space-y-2">
                <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-soft)] p-3 text-xs text-[var(--text-muted)]">
                  <p className="m-0 font-medium text-[var(--text-primary)]">AI Guidance</p>
                  <p className="m-0 mt-1">{guidance}</p>
                </div>
                <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-soft)] p-3 text-xs">
                  <p className="m-0 mb-2 flex items-center gap-2"><Smartphone size={13} /> Camera source</p>
                  <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} className="w-full rounded-xl border border-[var(--line-soft)] bg-transparent px-2 py-2 text-xs outline-none">
                    {devices.map((d) => (<option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(-4)}`}</option>))}
                  </select>
                  <button onClick={() => { void startCamera(); }} className="mt-2 w-full rounded-xl border border-[var(--line-soft)] px-3 py-2 text-xs">Switch / restart camera</button>
                </div>
                <button onClick={capturePhoto} className="w-full rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-4 py-2 text-sm font-semibold inline-flex items-center justify-center gap-2"><Camera size={15} /> Capture</button>
                <button onClick={() => { stopCamera(); setStep("details"); }} className="w-full rounded-xl border border-[var(--line-soft)] px-3 py-2 text-xs">Back</button>
              </div>
            </div>
          </section>
        ) : null}

        {step === "preview" ? (
          <section className="glass rounded-2xl p-4">
            <p className="mb-2 text-sm font-semibold">Step 5: Preview and submit</p>
            <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
              <div className="rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-soft)] p-3">
                <img src={capturedDataUrl} alt="Captured" className="h-[420px] w-full rounded-xl object-cover" />
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-soft)] p-4">
                  <p className="m-0 text-sm font-semibold">Live ID Preview</p>
                  <div className="mt-3 rounded-xl border border-[var(--line-soft)] bg-[linear-gradient(135deg,rgba(26,44,114,0.22),rgba(28,110,213,0.12))] p-3 text-xs">
                    <p className="m-0">School: {linkMeta?.school?.name}</p>
                    <p className="m-0 mt-1">Student: {draft.fullName}</p>
                    <p className="m-0 mt-1">Class: {draft.className}-{draft.section}</p>
                    <p className="m-0 mt-1">Roll: {draft.rollNumber}</p>
                    <p className="m-0 mt-1">Parent: {draft.parentName}</p>
                    <p className="m-0 mt-1">Photo BG: {linkMeta?.photoBgPreference || "NONE"}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-soft)] p-3 text-xs">
                  <p className="m-0 text-sm font-semibold">AI Photo Check</p>
                  {analyzingPhoto ? (
                    <p className="m-0 mt-2 text-[var(--text-muted)]">Analyzing face, light and clarity...</p>
                  ) : photoAnalysis ? (
                    <div className="mt-2 space-y-1">
                      <p className="m-0">
                        Status: <span className="font-semibold">{photoAnalysis.quality.status}</span>
                      </p>
                      <p className="m-0">Score: {photoAnalysis.quality.score ?? "--"}</p>
                      {photoAnalysis.quality.warnings?.length ? (
                        <ul className="m-0 list-disc pl-4 text-[#F7B4BF]">
                          {photoAnalysis.quality.warnings.map((w) => (
                            <li key={w}>{w}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="m-0 text-emerald-300">Photo passed quality checks.</p>
                      )}
                    </div>
                  ) : (
                    <p className="m-0 mt-2 text-[var(--text-muted)]">
                      No server analysis yet. Capture again if needed.
                    </p>
                  )}
                </div>
                <button
                  onClick={submitStudent}
                  disabled={analyzingPhoto}
                  className="w-full rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-4 py-2 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <CheckCircle2 size={15} /> {analyzingPhoto ? "Analyzing..." : "Submit student"}
                </button>
                <button onClick={() => { setStep("camera"); void startCamera(); }} className="w-full rounded-xl border border-[var(--line-soft)] px-3 py-2 text-xs">Retake photo</button>
              </div>
            </div>
          </section>
        ) : null}

        {step === "done" ? (
          <section className="glass rounded-2xl p-4 text-center">
            <p className="text-lg font-semibold">Submission complete</p>
            <p className="text-xs text-[var(--text-muted)]">You can add one more student for the same parent.</p>
            <button onClick={resetForSibling} className="mt-3 rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-4 py-2 text-sm font-semibold">Add one more student</button>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function ParentLoading() {
  return (
    <main className="min-h-screen bg-[var(--bg-base)] p-6 text-[var(--text-primary)]">
      <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-soft)] p-6">
        <p className="text-sm text-[var(--text-muted)]">Loading parent intake...</p>
      </div>
    </main>
  );
}



