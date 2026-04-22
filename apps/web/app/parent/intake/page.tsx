"use client";

import { Camera, CheckCircle2, ChevronRight, Plus, Save, ShieldCheck, Upload, Users } from "lucide-react";
import { ChangeEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import AdvancedCamera, { type CaptureResult } from "@/components/camera/AdvancedCamera";
import { useSearchParams } from "next/navigation";

type Step = "details" | "photo" | "review" | "done";
// ARCHIVED: type Step = "auth" | "otp" | "details" | "photo" | "review" | "done";
type ActorType = "PARENT" | "STUDENT" | "STAFF";

type PublicLinkMeta = {
  token: string;
  campaignName: string;
  institutionType: "SCHOOL" | "COLLEGE" | "COMPANY" | "COACHING_INSTITUTE";
  audience: "PARENT" | "STUDENT" | "EMPLOYEE";
  actorType: ActorType;
  className: string;
  section: string;
  photoBgPreference: string;
  allowDraftSave: boolean;
  allowPhotoUpload: boolean;
  photoCaptureRequired: boolean;
  school: { name: string; code: string };
  segment?: {
    segmentLabel?: string | null;
    primaryLabel?: string | null;
    primaryValue?: string | null;
    secondaryLabel?: string | null;
    secondaryValue?: string | null;
  };
  campaign?: {
    id: string;
    name: string;
    maxExpectedVolume: number;
    startsAt: string;
    expiresAt: string;
    actorType: ActorType;
    message: string;
  };
};

type SessionContext = {
  session: {
    id: string;
    actorType: ActorType;
    verifiedMobile: string;
    maskedMobile: string;
    otpVerifiedAt?: string | null;
    sessionStatus: string;
    expiresAt: string;
  };
  link: {
    token: string;
    campaignName: string;
    institutionType: PublicLinkMeta["institutionType"];
    audience: PublicLinkMeta["audience"];
    photoBgPreference: string;
    school: { name: string; code: string; email?: string | null; address?: string | null };
    segment: {
      segmentLabel?: string | null;
      primaryLabel?: string | null;
      primaryValue?: string | null;
      secondaryLabel?: string | null;
      secondaryValue?: string | null;
    };
  };
  campaign?: {
    id: string;
    name: string;
    maxExpectedVolume: number;
    startsAt: string;
    expiresAt: string;
  } | null;
  dataSchema: {
    fullName?: boolean;
    photo?: boolean;
    className?: boolean;
    division?: boolean;
    rollNumber?: boolean;
    dob?: boolean;
    bloodGroup?: boolean;
    parentName?: boolean;
    mobileNumber?: boolean;
    emergencyNumber?: boolean;
    fullAddress?: boolean;
    aadhaarNumber?: boolean;
    rfidRequired?: boolean;
  };
  submissionModel: {
    mode: string;
    actorType: ActorType;
    requirePhotoStandardization?: boolean;
    requireParentOtp?: boolean;
    workflowRequired?: boolean;
    bulkUploadEnabled?: boolean;
    intakeLinkOptional?: boolean;
    allowMobileEditAfterVerification?: boolean;
    duplicatePolicy?: string;
    allowDraftSave?: boolean;
    allowPhotoUpload?: boolean;
    photoCaptureRequired?: boolean;
    photoBgPreference?: string;
    paymentRequired?: boolean;
  };
  draft?: Record<string, unknown>;
};

type IntakeDraft = {
  fullName: string;
  parentName: string;
  mobile: string;
  className: string;
  division: string;
  rollNumber: string;
  address: string;
  dob: string;
  bloodGroup: string;
  emergencyNumber: string;
  aadhaarNumber: string;
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
    audience?: string;
    actorType?: string;
    segmentLabel?: string;
  };
};

type CaptureAssistantState = {
  guidanceMode: "native" | "fallback" | "manual";
  detectorAvailable: boolean;
  ready: boolean;
  faceDetected: boolean;
  faceCentered: boolean;
  lightingGood: boolean;
  backgroundGood: boolean;
  distanceGood: boolean;
  message: string;
};

const DEFAULT_CAPTURE_ASSISTANT: CaptureAssistantState = {
  guidanceMode: "manual",
  detectorAvailable: false,
  ready: false,
  faceDetected: false,
  faceCentered: false,
  lightingGood: false,
  backgroundGood: true,
  distanceGood: false,
  message: "Allow camera access and keep the face centered."
};

const CAPTURE_STABILITY_TARGET = 2;
const CAMERA_ANALYSIS_INTERVAL_MS = 180;
const MAX_PRINT_PROCESSING_EDGE = 1400;
const MIN_PRINT_EXPORT_EDGE = 600;

export default function ParentIntakePage() {
  return (
    <Suspense fallback={<PortalLoading />}>
      <IntakePortalInner />
    </Suspense>
  );
}

function IntakePortalInner() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api/v2";
  const exposeDevOtp = process.env.NEXT_PUBLIC_EXPOSE_DEV_OTP === "true";
  const search = useSearchParams();
  const tokenFromUrl = search?.get("token") || search?.get("intake_token") || "";

  const [step, setStep] = useState<Step>("details");
  const [publicMeta, setPublicMeta] = useState<PublicLinkMeta | null>(null);
  const [sessionContext, setSessionContext] = useState<SessionContext | null>(null);
  const [sessionToken, setSessionToken] = useState("");
  // ARCHIVED: const [authSessionId, setAuthSessionId] = useState("");
  const [mobile, setMobile] = useState("");
  // ARCHIVED: const [otp, setOtp] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loadingMeta, setLoadingMeta] = useState(true);
  // ARCHIVED: const [sendingOtp, setSendingOtp] = useState(false);
  // ARCHIVED: const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [guidance, setGuidance] = useState("Allow camera access and keep the face centered.");
  const [captureAssistant, setCaptureAssistant] = useState<CaptureAssistantState>(DEFAULT_CAPTURE_ASSISTANT);
  const [captureStability, setCaptureStability] = useState(0);
  const [savedSubmissions, setSavedSubmissions] = useState(0);
  const [capturedDataUrl, setCapturedDataUrl] = useState("");
  const [photoAnalysis, setPhotoAnalysis] = useState<PhotoAnalysisState | null>(null);
  const [enhancingPhoto, setEnhancingPhoto] = useState(false);
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
  const [rawPhotoUrl, setRawPhotoUrl] = useState("");
  const [showOriginalPhoto, setShowOriginalPhoto] = useState(false);
  const [showPhotoTips, setShowPhotoTips] = useState(true);
  // ARCHIVED: const [resendAt, setResendAt] = useState(0);
  // ARCHIVED: const [now, setNow] = useState(Date.now());
  const [draft, setDraft] = useState<IntakeDraft>({
    fullName: "",
    parentName: "",
    mobile: "",
    className: "",
    division: "",
    rollNumber: "",
    address: "",
    dob: "",
    bloodGroup: "",
    emergencyNumber: "",
    aadhaarNumber: ""
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectorRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceBoxRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const analysisTimerRef = useRef<number | null>(null);
  const captureReadyRef = useRef(false);
  const captureInFlightRef = useRef(false);
  const stableFrameCountRef = useRef(0);

  const actorType = sessionContext?.session.actorType || publicMeta?.actorType || "PARENT";
  const currentSchema = sessionContext?.dataSchema || {};
  const submissionModel: SessionContext["submissionModel"] = sessionContext?.submissionModel || {
    mode: "OTP_FIRST",
    actorType
  };
  const segment = sessionContext?.link.segment || publicMeta?.segment;
  const primaryLabel = segment?.primaryLabel || (publicMeta?.institutionType === "COLLEGE" ? "Department" : "Class");
  const secondaryLabel =
    segment?.secondaryLabel || (publicMeta?.institutionType === "COLLEGE" ? "Year" : "Division");
  const fixedPrimaryValue = normalizeFixedSegment(segment?.primaryValue) || normalizeFixedSegment(publicMeta?.className);
  const fixedSecondaryValue = normalizeFixedSegment(segment?.secondaryValue) || normalizeFixedSegment(publicMeta?.section);
  const segmentLabel =
    sanitizeSegmentLabel(segment?.segmentLabel) ||
    buildSegmentLabel(publicMeta?.institutionType || sessionContext?.link.institutionType, fixedPrimaryValue, fixedSecondaryValue);
  const showClassName = Boolean(currentSchema.className);
  const showDivision = Boolean(currentSchema.division);
  const showRollNumber = Boolean(currentSchema.rollNumber);
  const showParentName = Boolean(currentSchema.parentName) && actorType === "PARENT";
  const showMobile = Boolean(currentSchema.mobileNumber);
  const showAddress = Boolean(currentSchema.fullAddress);
  const showDob = Boolean(currentSchema.dob);
  const showBloodGroup = Boolean(currentSchema.bloodGroup);
  const showEmergencyNumber = Boolean(currentSchema.emergencyNumber);
  const showAadhaarNumber = Boolean(currentSchema.aadhaarNumber);
  const showRfid = Boolean(currentSchema.rfidRequired);
  // Anon sessions have "ANON" as verifiedMobile — fall back to the user-entered mobile from the form
  const verifiedMobile = (sessionContext?.session.verifiedMobile === "ANON" ? "" : sessionContext?.session.verifiedMobile) || mobile;
  const allowMobileEdit = true; // Always allow mobile edit in anon session mode
  // ARCHIVED: const allowMobileEdit = Boolean(submissionModel.allowMobileEditAfterVerification);
  const configuredPhotoBackgroundPreference = (
    submissionModel.photoBgPreference ||
    sessionContext?.link.photoBgPreference ||
    publicMeta?.photoBgPreference ||
    "NONE"
  ).toUpperCase();
  const photoBackgroundPreference =
    configuredPhotoBackgroundPreference === "WHITE" ? "PLAIN" : configuredPhotoBackgroundPreference;

  const progressSteps = useMemo<Step[]>(() => ["details", "photo", "review", "done"], []);
  // ARCHIVED: const progressSteps = useMemo<Step[]>(() => ["auth", "otp", "details", "photo", "review", "done"], []);
  const progress = useMemo(() => {
    const index = Math.max(progressSteps.indexOf(step), 0);
    return ((index + 1) / progressSteps.length) * 100;
  }, [progressSteps, step]);

  useEffect(() => {
    if (tokenFromUrl) {
      void loadPublicEntry(tokenFromUrl);
    }
    return () => {
      stopCamera();
      if (analysisTimerRef.current) window.clearInterval(analysisTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenFromUrl]);

  // ARCHIVED: OTP resend timer — remove when OTP is re-enabled
  // useEffect(() => {
  //   if (resendAt <= Date.now()) return;
  //   const timer = window.setInterval(() => setNow(Date.now()), 500);
  //   return () => window.clearInterval(timer);
  // }, [resendAt]);

  async function loadPublicEntry(token: string) {
    setLoadingMeta(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/intake-links/token/${encodeURIComponent(token)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Invalid intake link");
      setPublicMeta(data as PublicLinkMeta);

      // Create an anonymous session (no OTP) and load the session context directly
      const anonRes = await fetch(`${apiBase}/intake-links/auth/anon-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intakeToken: (data as PublicLinkMeta).token })
      });
      const anonData = await anonRes.json();
      if (!anonRes.ok) throw new Error(anonData.message || anonData.error || "Unable to start intake session");
      const anonToken: string = anonData.intakeSessionToken;
      setSessionToken(anonToken);
      await loadSessionContext(anonToken);

      // ARCHIVED: OTP flow — setStep("auth") replaced by anon session above
      // setStep("auth");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load intake link");
    } finally {
      setLoadingMeta(false);
    }
  }

  // ARCHIVED: sendOtp — OTP layer removed; re-enable by restoring this function and the auth/otp steps
  // async function sendOtp() {
  //   if (!publicMeta?.token) { setError("Intake link not available"); return; }
  //   const normalizedMobile = normalizeMobile(mobile);
  //   if (!normalizedMobile) { setError("Enter a valid 10-digit mobile number"); return; }
  //   setSendingOtp(true); setError(""); setStatus("");
  //   try {
  //     const res = await fetch(`${apiBase}/intake-links/auth/start-otp`, {
  //       method: "POST", headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ intakeToken: publicMeta.token, mobile: normalizedMobile })
  //     });
  //     const data = await res.json();
  //     if (!res.ok) throw new Error(data.message || data.error || "OTP send failed");
  //     setMobile(normalizedMobile); setAuthSessionId(data.authSessionId);
  //     setResendAt(Date.now() + 30_000); setNow(Date.now()); setStep("otp");
  //     setStatus(exposeDevOtp && data.devOtp ? `OTP sent. Dev OTP: ${data.devOtp}` : `OTP sent to ${data.maskedMobile || maskMobile(normalizedMobile)}`);
  //   } catch (e) { setError(e instanceof Error ? e.message : "OTP send failed"); }
  //   finally { setSendingOtp(false); }
  // }

  // ARCHIVED: verifyOtp — OTP layer removed; re-enable by restoring this function and the auth/otp steps
  // async function verifyOtp() {
  //   if (!authSessionId) { setError("Start mobile verification first"); return; }
  //   setVerifyingOtp(true); setError(""); setStatus("");
  //   try {
  //     const res = await fetch(`${apiBase}/intake-links/auth/verify-otp`, {
  //       method: "POST", headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ authSessionId, otp })
  //     });
  //     const data = await res.json();
  //     if (!res.ok) throw new Error(data.message || data.error || "OTP verification failed");
  //     setSessionToken(data.intakeSessionToken);
  //     await loadSessionContext(data.intakeSessionToken);
  //     setStatus(`Mobile verified for ${data.maskedMobile || maskMobile(mobile)}`);
  //   } catch (e) { setError(e instanceof Error ? e.message : "OTP verify failed"); }
  //   finally { setVerifyingOtp(false); }
  // }

  async function loadSessionContext(token: string) {
    setLoadingSession(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/intake-links/session`, {
        headers: {
          "x-intake-session-token": token
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Unable to open intake session");
      const ctx = data as SessionContext;
      setSessionContext(ctx);
      setDraft({
        fullName: readDraftValue(ctx.draft, "fullName"),
        parentName: readDraftValue(ctx.draft, "parentName"),
        mobile: readDraftValue(ctx.draft, "mobile") || (ctx.session.verifiedMobile === "ANON" ? "" : ctx.session.verifiedMobile),
        className: readDraftValue(ctx.draft, "className") || readDraftValue(ctx.draft, "primaryValue") || fixedPrimaryValue,
        division:
          readDraftValue(ctx.draft, "division") ||
          readDraftValue(ctx.draft, "secondaryValue") ||
          fixedSecondaryValue ||
          readDraftValue(ctx.draft, "section"),
        rollNumber: readDraftValue(ctx.draft, "rollNumber"),
        address: readDraftValue(ctx.draft, "address"),
        dob: readDraftValue(ctx.draft, "dob"),
        bloodGroup: readDraftValue(ctx.draft, "bloodGroup"),
        emergencyNumber: readDraftValue(ctx.draft, "emergencyNumber"),
        aadhaarNumber: readDraftValue(ctx.draft, "aadhaarNumber")
      });
      setStep("details");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load intake session");
    } finally {
      setLoadingSession(false);
    }
  }

  function sessionHeaders(token = sessionToken) {
    return {
      "Content-Type": "application/json",
      "x-intake-session-token": token
    };
  }

  function validateDetails() {
    const issues: string[] = [];
    if (!draft.fullName.trim()) issues.push(actorType === "PARENT" ? "Student name is required" : "Full name is required");
    if (showClassName && !fixedPrimaryValue && !draft.className.trim()) {
      issues.push(`${primaryLabel} is required`);
    }
    if (showDivision && secondaryLabel && !fixedSecondaryValue && !draft.division.trim()) {
      issues.push(`${secondaryLabel} is required`);
    }
    if (showRollNumber && !draft.rollNumber.trim()) {
      issues.push("Roll number is required");
    }
    if (showParentName && !draft.parentName.trim()) {
      issues.push("Parent name is required");
    }
    if (showMobile && !normalizeMobile(draft.mobile || verifiedMobile)) {
      issues.push("Mobile number is required");
    }
    if (showAddress && !draft.address.trim()) {
      issues.push("Address is required");
    }
    if (showDob && !draft.dob) {
      issues.push("Date of birth is required");
    }
    if (showBloodGroup && !draft.bloodGroup.trim()) {
      issues.push("Blood group is required");
    }
    if (showEmergencyNumber && !normalizeMobile(draft.emergencyNumber)) {
      issues.push("Emergency number is required");
    }
    if (showAadhaarNumber && !normalizeAadhaar(draft.aadhaarNumber)) {
      issues.push("Aadhaar number is required");
    }
    if (issues.length) {
      setError(issues.join(", "));
      return false;
    }
    return true;
  }

  async function saveDraft() {
    if (!sessionToken) return;
    if (!submissionModel.allowDraftSave) return;
    setSavingDraft(true);
    setError("");
    setStatus("");
    try {
      const res = await fetch(`${apiBase}/intake-links/session/draft`, {
        method: "POST",
        headers: sessionHeaders(),
        body: JSON.stringify({
          fullName: draft.fullName.trim() || undefined,
          parentName: draft.parentName.trim() || undefined,
          mobile: normalizeMobile(draft.mobile || verifiedMobile) || undefined,
          className: (fixedPrimaryValue || draft.className).trim() || undefined,
          division: (fixedSecondaryValue || draft.division).trim() || undefined,
          rollNumber: draft.rollNumber.trim() || undefined,
          segmentPrimaryValue: (fixedPrimaryValue || draft.className).trim() || undefined,
          segmentSecondaryValue: (fixedSecondaryValue || draft.division).trim() || undefined,
          address: draft.address.trim() || undefined,
          dob: draft.dob || undefined,
          bloodGroup: draft.bloodGroup.trim() || undefined,
          emergencyNumber: normalizeMobile(draft.emergencyNumber) || undefined,
          aadhaarNumber: normalizeAadhaar(draft.aadhaarNumber) || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Draft save failed");
      setStatus("Draft saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Draft save failed");
    } finally {
      setSavingDraft(false);
    }
  }

  function resetCaptureReadiness() {
    stableFrameCountRef.current = 0;
    setCaptureStability(0);
    captureReadyRef.current = false;
  }

  function applyCaptureAssistant(next: CaptureAssistantState) {
    captureReadyRef.current = next.ready;
    setCaptureAssistant(next);
    setGuidance(next.message);
  }

  async function processSelectedPhoto(dataUrl: string) {
    setEnhancingPhoto(true);
    setStatus("Preparing print-ready photo...");
    setError("");
    try {
      let finalDataUrl = dataUrl;
      try {
        finalDataUrl = await enhancePhotoForPrint(dataUrl, photoBackgroundPreference);
      } catch {
        finalDataUrl = dataUrl;
      }
      setCapturedDataUrl(finalDataUrl);
      setPhotoAnalysis(null);
      setStep("review");
      const analysis = await analyzeCapturedPhoto(finalDataUrl);
      return Boolean(analysis);
    } finally {
      setEnhancingPhoto(false);
    }
  }

  async function moveToPhoto() {
    setError("");
    if (!validateDetails()) return;
    setShowPhotoTips(true);   // always show tips before camera
    setStep("photo");
  }

  async function openCameraAfterTips() {
    setShowPhotoTips(false);
    await startCamera();
  }

  async function startCamera(preserveFeedback = false) {
    if (!preserveFeedback) {
      setError("");
      setStatus("");
    }
    resetCaptureReadiness();
    captureInFlightRef.current = false;
    setCaptureAssistant(DEFAULT_CAPTURE_ASSISTANT);
    setGuidance(DEFAULT_CAPTURE_ASSISTANT.message);
    try {
      stopCamera();
      const preferredVideoConstraints = {
        width: { ideal: 1440 },
        height: { ideal: 1920 }
      } as const;
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, ...preferredVideoConstraints }
          : { facingMode: "user", ...preferredVideoConstraints },
        audio: false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const list = await navigator.mediaDevices.enumerateDevices();
      const cams = list.filter((device) => device.kind === "videoinput");
      setDevices(cams);
      if (!deviceId && cams[0]) setDeviceId(cams[0].deviceId);

      const FaceDetectorCtor = (window as any).FaceDetector;
      detectorRef.current = FaceDetectorCtor ? new FaceDetectorCtor({ fastMode: true, maxDetectedFaces: 1 }) : null;
      if (analysisTimerRef.current) window.clearInterval(analysisTimerRef.current);
      analysisTimerRef.current = window.setInterval(() => {
        void analyzeFrame();
      }, CAMERA_ANALYSIS_INTERVAL_MS);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Camera access failed");
    }
  }

  function stopCamera() {
    resetCaptureReadiness();
    faceBoxRef.current = null;
    if (analysisTimerRef.current) {
      window.clearInterval(analysisTimerRef.current);
      analysisTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  async function analyzeFrame() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const { brightness, edgeBrightness, edgeVariance } = sampleVideoFrameMetrics(video);
    const backgroundGood = isBackgroundReady(photoBackgroundPreference, edgeBrightness, edgeVariance);
    const backgroundBlocking = isBackgroundBlocking(photoBackgroundPreference, backgroundGood, edgeVariance);
    let face: any = null;

    if (detectorRef.current) {
      try {
        const faces = await detectorRef.current.detect(video);
        face = faces?.[0]?.boundingBox || null;
      } catch {
        face = null;
      }
    }

    if (!detectorRef.current) {
      const fallback = analyzeFallbackFace(video);
      const lightingGood = brightness >= 70;
      const allChecksPassing =
        fallback.faceDetected && fallback.faceCentered && fallback.distanceGood && lightingGood && !backgroundBlocking;
      const stableFrameCount = allChecksPassing
        ? Math.min(stableFrameCountRef.current + 1, CAPTURE_STABILITY_TARGET)
        : 0;
      stableFrameCountRef.current = stableFrameCount;
      setCaptureStability(stableFrameCount);
      const stableReady = allChecksPassing && stableFrameCount >= CAPTURE_STABILITY_TARGET;

      applyCaptureAssistant({
        guidanceMode: "fallback",
        detectorAvailable: false,
        ready: stableReady,
        faceDetected: fallback.faceDetected,
        faceCentered: fallback.faceCentered,
        lightingGood,
        backgroundGood,
        distanceGood: fallback.distanceGood,
        message: !fallback.faceDetected
          ? "Face not clear yet. Keep the face inside the center frame and look straight at the camera."
          : !fallback.faceCentered
            ? "Move the face into the middle of the center frame."
            : !fallback.distanceGood
              ? "Move a little closer so the face fills the guide properly."
              : !lightingGood
                ? "Lighting is low. Move to a brighter area and hold steady."
                : backgroundBlocking
                  ? backgroundGuidance(photoBackgroundPreference)
                  : !backgroundGood
                    ? "Plain background preferred, but you can continue. Hold steady until capture is ready."
                    : stableFrameCount < CAPTURE_STABILITY_TARGET
                      ? `Hold steady for capture readiness (${stableFrameCount}/${CAPTURE_STABILITY_TARGET})`
                      : "Face aligned. Capture now."
      });
      return;
    }

    if (!face) {
      faceBoxRef.current = null;
      resetCaptureReadiness();
      applyCaptureAssistant({
        guidanceMode: "native",
        detectorAvailable: true,
        ready: false,
        faceDetected: false,
        faceCentered: false,
        lightingGood: brightness >= 65,
        backgroundGood,
        distanceGood: false,
        message:
          brightness < 65
            ? "Increase light and keep the face in the middle of the frame."
            : "Face not detected. Move the face into the middle of the frame."
      });
      return;
    }

    faceBoxRef.current = { x: face.x, y: face.y, width: face.width, height: face.height };
    const cx = face.x + face.width / 2;
    const cy = face.y + face.height / 2;
    const dx = Math.abs(cx - video.videoWidth / 2);
    const dy = Math.abs(cy - video.videoHeight / 2);
    const areaRatio = (face.width * face.height) / (video.videoWidth * video.videoHeight);
    const lightingGood = brightness >= 65;
    const faceCentered = dx <= video.videoWidth * 0.16 && dy <= video.videoHeight * 0.2;
    const distanceGood = areaRatio >= 0.08;
    const allChecksPassing = lightingGood && faceCentered && distanceGood && !backgroundBlocking;
    const stableFrameCount = allChecksPassing
      ? Math.min(stableFrameCountRef.current + 1, CAPTURE_STABILITY_TARGET)
      : 0;
    stableFrameCountRef.current = stableFrameCount;
    setCaptureStability(stableFrameCount);
    const stableReady = allChecksPassing && stableFrameCount >= CAPTURE_STABILITY_TARGET;

    applyCaptureAssistant({
      guidanceMode: "native",
      detectorAvailable: true,
      ready: stableReady,
      faceDetected: true,
      faceCentered,
      lightingGood,
      backgroundGood,
      distanceGood,
      message: !lightingGood
        ? "Lighting is low. Move to a brighter area."
        : !faceCentered
          ? "Center the face in the middle of the frame."
          : !distanceGood
            ? "Move a little closer so the face fits the passport crop."
            : backgroundBlocking
              ? backgroundGuidance(photoBackgroundPreference)
              : !backgroundGood
                ? "Plain background preferred, but you can continue. Keep the face centered and hold steady."
              : stableFrameCount < CAPTURE_STABILITY_TARGET
                ? `Hold steady for a clear capture (${stableFrameCount}/${CAPTURE_STABILITY_TARGET})`
                : "Face clear. Capture now."
    });
  }

  async function capturePhoto() {
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas) return;
    if (captureInFlightRef.current) return;
    if (!captureReadyRef.current) {
      setError("Wait for face, lighting, and background guidance to turn ready before capturing.");
      return;
    }
    captureInFlightRef.current = true;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      captureInFlightRef.current = false;
      return;
    }

    const crop = getPassportCropRect(video.videoWidth, video.videoHeight, faceBoxRef.current);
    canvas.width = crop.sw;
    canvas.height = crop.sh;
    ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, crop.sw, crop.sh);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    stopCamera();
    try {
      await processSelectedPhoto(dataUrl);
    } finally {
      captureInFlightRef.current = false;
    }
  }

  async function handlePhotoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) return;
      const croppedDataUrl = await cropImageDataUrlToPassport(dataUrl);
      setRawPhotoUrl(croppedDataUrl);
      setShowOriginalPhoto(false);
      stopCamera();
      setEnhancingPhoto(true);
      setError("");
      setPhotoAnalysis(null);
      try {
        let enhanced = croppedDataUrl;
        setStatus("Step 1/2 — Tone & sharpness…");
        try { enhanced = await enhancePhotoForPrint(croppedDataUrl, photoBackgroundPreference); } catch {}
        setStatus("Step 2/2 — Face polish & enhance…");
        try { enhanced = await applyFaceRetouch(enhanced); } catch {}
        setCapturedDataUrl(enhanced);
        setStatus("");
        void analyzeCapturedPhoto(enhanced);
      } finally {
        setEnhancingPhoto(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function analyzeCapturedPhoto(dataUrl: string) {
    setAnalyzingPhoto(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/intake-links/photo-analyze`, {
        method: "POST",
        headers: sessionHeaders(),
        body: JSON.stringify({
          intakeToken: sessionContext?.link.token || publicMeta?.token,
          photoDataUrl: dataUrl,
          preferredPhotoName: draft.fullName.trim() || "student-photo"
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Photo analysis failed");
      const next = data as PhotoAnalysisState;
      setPhotoAnalysis(next);
      if (next.quality.status === "FAILED") {
        setStatus("");
        setError(next.quality.warnings[0] || "Photo quality check failed. Please try again.");
      } else {
        setStatus(`Photo quality ${next.quality.status} (score ${next.quality.score ?? "--"})`);
      }
      return next;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Photo analysis failed");
      return null;
    } finally {
      setAnalyzingPhoto(false);
    }
  }

  async function submitIntake() {
    if (!sessionContext) return;
    setSubmitting(true);
    setError("");
    setStatus("");
    try {
      const res = await fetch(`${apiBase}/intake-links/submissions`, {
        method: "POST",
        headers: sessionHeaders(),
        body: JSON.stringify({
          intakeToken: sessionContext.link.token,
          fullName: draft.fullName.trim(),
          parentName: showParentName ? draft.parentName.trim() : undefined,
          mobile: normalizeMobile(draft.mobile || verifiedMobile) || undefined,
          className: (fixedPrimaryValue || draft.className).trim(),
          division: (fixedSecondaryValue || draft.division).trim(),
          rollNumber: draft.rollNumber.trim() || undefined,
          section: (fixedSecondaryValue || draft.division).trim(),
          segmentPrimaryValue: (fixedPrimaryValue || draft.className).trim(),
          segmentSecondaryValue: (fixedSecondaryValue || draft.division).trim(),
          address: draft.address.trim() || undefined,
          dob: draft.dob || undefined,
          bloodGroup: draft.bloodGroup.trim() || undefined,
          emergencyNumber: normalizeMobile(draft.emergencyNumber) || undefined,
          aadhaarNumber: normalizeAadhaar(draft.aadhaarNumber) || undefined,
          preferredPhotoName: draft.fullName.trim() || "student-photo",
          photoAnalysisId: photoAnalysis?.analysisId,
          photoKey: photoAnalysis?.photoKey,
          photoDataUrl: photoAnalysis?.analysisId ? undefined : capturedDataUrl
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || "Submit failed");
      setSavedSubmissions((value) => value + 1);
      setStatus("Intake submitted successfully");
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  function continueToReview() {
    setError("");
    setStatus("");
    setStep("review");
  }

  function resetForNext() {
    setCapturedDataUrl("");
    setRawPhotoUrl("");
    setPhotoAnalysis(null);
    setShowOriginalPhoto(false);
    setDraft({
      fullName: "",
      parentName: "",
      mobile: verifiedMobile,
      className: fixedPrimaryValue || "",
      division: fixedSecondaryValue || "",
      rollNumber: "",
      address: "",
      dob: "",
      bloodGroup: "",
      emergencyNumber: "",
      aadhaarNumber: ""
    });
    setStep("details");
  }

  function resetForSibling() {
    setCapturedDataUrl("");
    setRawPhotoUrl("");
    setPhotoAnalysis(null);
    setShowOriginalPhoto(false);
    // Keep parent's verified mobile — sibling belongs to same parent
    setDraft({
      fullName: "",
      parentName: draft.parentName,
      mobile: verifiedMobile,
      className: fixedPrimaryValue || draft.className,
      division: fixedSecondaryValue || draft.division,
      rollNumber: "",
      address: draft.address,
      dob: "",
      bloodGroup: "",
      emergencyNumber: draft.emergencyNumber,
      aadhaarNumber: ""
    });
    setStep("details");
  }

  if (loadingMeta) {
    return <PortalLoading />;
  }

  return (
    <main className="min-h-screen bg-[var(--bg-base)] px-3 py-4 text-[var(--text-primary)] md:px-8 md:py-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="glass rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="m-0 text-lg font-semibold">{getPortalHeading(actorType)}</p>
              <p className="m-0 mt-1 text-xs text-[var(--text-muted)]">
                {publicMeta?.campaignName || sessionContext?.link.campaignName || "Secure intake workflow"}
              </p>
              {segmentLabel ? <p className="m-0 mt-1 text-[11px] text-[var(--text-muted)]">{segmentLabel}</p> : null}
            </div>
            <span className="rounded-xl border border-[var(--line-soft)] px-3 py-1 text-[11px] text-[var(--text-muted)]">
              {savedSubmissions} submitted
            </span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-[rgba(15,60,120,0.3)]">
            <div
              className="h-2 rounded-full bg-[linear-gradient(90deg,#0F3C78,#1C6ED5)] transition-[width] duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {status ? <p className="text-xs text-emerald-300">{status}</p> : null}
        {error ? <p className="text-xs text-rose-300">{error}</p> : null}

        {/* ARCHIVED: OTP auth steps — restore these sections to re-enable OTP
        {step === "auth" ? (
          <section className="glass rounded-2xl p-4">
            <p className="mb-1 text-sm font-semibold">Step 1: Mobile authentication</p>
            <p className="mb-3 text-xs text-[var(--text-muted)]">{publicMeta?.campaign?.message || getActorMessage(actorType)}</p>
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <input value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g,"").slice(0,10))}
                placeholder={getMobilePlaceholder(actorType)} inputMode="numeric" autoComplete="tel"
                className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none" />
              <button onClick={sendOtp} disabled={sendingOtp}
                className="rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-4 py-2 text-sm font-semibold disabled:opacity-60">
                {sendingOtp ? "Sending..." : "Send OTP"}
              </button>
            </div>
          </section>
        ) : null}
        {step === "otp" ? (
          <section className="glass rounded-2xl p-4">
            <p className="mb-1 text-sm font-semibold">Step 2: Verify OTP</p>
            <p className="mb-3 text-xs text-[var(--text-muted)]">Enter the 6-digit OTP sent to {maskMobile(mobile)}.</p>
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g,"").slice(0,6))}
                placeholder="6-digit OTP" inputMode="numeric" autoComplete="one-time-code"
                className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none" />
              <button onClick={verifyOtp} disabled={verifyingOtp}
                className="rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-4 py-2 text-sm font-semibold disabled:opacity-60">
                {verifyingOtp ? "Verifying..." : "Verify OTP"}
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>OTP is required before the form can open.</span>
              <button type="button" onClick={() => void sendOtp()} disabled={sendingOtp || resendAt > now}
                className="rounded-lg border border-[var(--line-soft)] px-3 py-1 disabled:opacity-50">
                {resendAt > now ? `Resend in ${Math.ceil((resendAt - now) / 1000)}s` : "Resend OTP"}
              </button>
            </div>
          </section>
        ) : null}
        */}

        {loadingSession ? (
          <section className="glass rounded-2xl p-4">
            <p className="text-sm text-[var(--text-muted)]">Opening intake form...</p>
          </section>
        ) : null}

        {step === "details" && sessionContext ? (
          <section className="glass rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="m-0 text-sm font-semibold">Step 1: Intake form</p>
              <div className="flex flex-wrap gap-2">
                {showRfid ? <Badge text="RFID required" /> : null}
                {submissionModel.workflowRequired ? <Badge text="Workflow enabled" /> : null}
                {submissionModel.requirePhotoStandardization !== false ? <Badge text="Photo standardization" /> : null}
              </div>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <Field
                value={draft.fullName}
                onChange={(value) => setDraft((prev) => ({ ...prev, fullName: value }))}
                placeholder={actorType === "PARENT" ? "Student full name" : "Full name"}
              />
              {showParentName ? (
                <Field
                  value={draft.parentName}
                  onChange={(value) => setDraft((prev) => ({ ...prev, parentName: value }))}
                  placeholder="Parent full name"
                />
              ) : null}
              {showClassName ? (
                fixedPrimaryValue ? (
                  <ReadonlyField label={primaryLabel} value={fixedPrimaryValue} />
                ) : (
                  <Field
                    value={draft.className}
                    onChange={(value) => setDraft((prev) => ({ ...prev, className: value }))}
                    placeholder={primaryLabel}
                  />
                )
              ) : null}
              {showDivision && secondaryLabel ? (
                fixedSecondaryValue ? (
                  <ReadonlyField label={secondaryLabel} value={fixedSecondaryValue} />
                ) : (
                  <Field
                    value={draft.division}
                    onChange={(value) => setDraft((prev) => ({ ...prev, division: value }))}
                    placeholder={secondaryLabel}
                  />
                )
              ) : null}
              {showRollNumber ? (
                <Field
                  value={draft.rollNumber}
                  onChange={(value) => setDraft((prev) => ({ ...prev, rollNumber: value }))}
                  placeholder="Roll number"
                />
              ) : null}
              {showMobile ? (
                allowMobileEdit ? (
                  <Field
                    value={draft.mobile || verifiedMobile}
                    onChange={(value) =>
                      setDraft((prev) => ({ ...prev, mobile: value.replace(/\D/g, "").slice(0, 10) }))
                    }
                    placeholder="Mobile number (10 digits)"
                  />
                ) : (
                  <ReadonlyField label="Verified Mobile" value={draft.mobile || verifiedMobile} tone="verified" />
                )
              ) : null}
              {showDob ? (
                <Field
                  value={draft.dob}
                  onChange={(value) => setDraft((prev) => ({ ...prev, dob: value }))}
                  type="date"
                  placeholder="Date of birth"
                />
              ) : null}
              {showBloodGroup ? (
                <Field
                  value={draft.bloodGroup}
                  onChange={(value) => setDraft((prev) => ({ ...prev, bloodGroup: value.toUpperCase() }))}
                  placeholder="Blood group"
                />
              ) : null}
              {showAddress ? (
                <textarea
                  value={draft.address}
                  onChange={(event) => setDraft((prev) => ({ ...prev, address: event.target.value }))}
                  placeholder="Full address"
                  className="md:col-span-2 rounded-xl border border-[var(--line-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
                />
              ) : null}
              {showEmergencyNumber ? (
                <Field
                  value={draft.emergencyNumber}
                  onChange={(value) =>
                    setDraft((prev) => ({ ...prev, emergencyNumber: value.replace(/\D/g, "").slice(0, 10) }))
                  }
                  placeholder="Emergency number"
                />
              ) : null}
              {showAadhaarNumber ? (
                <Field
                  value={draft.aadhaarNumber}
                  onChange={(value) =>
                    setDraft((prev) => ({ ...prev, aadhaarNumber: value.replace(/\D/g, "").slice(0, 12) }))
                  }
                  placeholder="Aadhaar number"
                />
              ) : null}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {submissionModel.allowDraftSave ? (
                <button
                  onClick={() => void saveDraft()}
                  disabled={savingDraft}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--line-soft)] px-4 py-2 text-sm disabled:opacity-60"
                >
                  <Save size={14} /> {savingDraft ? "Saving..." : "Save draft"}
                </button>
              ) : null}
              <button
                onClick={() => void moveToPhoto()}
                className="inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-4 py-2 text-sm font-semibold"
              >
                <ChevronRight size={14} /> Continue to photo
              </button>
            </div>
          </section>
        ) : null}

        {step === "photo" && sessionContext ? (
          <section className="glass rounded-2xl p-4">
            <div className="mb-2">
              <p className="text-sm font-semibold">Step 4: Photo upload or capture</p>
            </div>

            {/* ── Photo tips screen (shown before camera opens) ── */}
            {showPhotoTips && !capturedDataUrl && !enhancingPhoto ? (
              <PhotoTipsScreen onOpenCamera={() => void openCameraAfterTips()} />
            ) : null}

            {/* ── AI-guided camera or captured preview ── */}
            {(!showPhotoTips || capturedDataUrl || enhancingPhoto) && (capturedDataUrl || enhancingPhoto) ? (
              /* ── Retouched photo preview + before/after toggle ── */
              <div className="flex flex-col items-center gap-4">
                {/* Container matches AdvancedCamera viewport: max 420px, 3:4 ratio */}
                <div className="relative w-full overflow-hidden rounded-3xl border-2
                                border-green-500/50 shadow-2xl shadow-green-500/10"
                     style={{ maxWidth: 420, aspectRatio: "3/4" }}>

                  {/* Photo or enhancing spinner — fills the aspect-ratio box */}
                  {enhancingPhoto ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950 px-6 gap-5">
                      {/* Pulsing face outline icon */}
                      <div className="relative flex items-center justify-center">
                        <div className="h-16 w-16 animate-ping absolute rounded-full bg-blue-600/20" />
                        <div className="h-14 w-14 animate-spin rounded-full border-2 border-blue-600/30 border-t-blue-500" />
                        <svg className="absolute h-7 w-7 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <circle cx="12" cy="8" r="4" />
                          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                        </svg>
                      </div>
                      {/* Step pills */}
                      <div className="flex gap-2">
                        {[
                          { label: "Tone & Sharpen", done: status.includes("2/2") || status === "" },
                          { label: "Face Enhance",   done: status === "" },
                        ].map((s, i) => {
                          const active =
                            (i === 0 && status.includes("1/2")) ||
                            (i === 1 && status.includes("2/2"));
                          return (
                            <span key={i} className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-all ${
                              s.done
                                ? "bg-green-700/50 text-green-300"
                                : active
                                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/40"
                                  : "bg-gray-800 text-gray-500"
                            }`}>
                              {s.done ? "✓ " : ""}{s.label}
                            </span>
                          );
                        })}
                      </div>
                      <p className="text-center text-[11px] text-blue-200 font-medium">
                        {status || "Finishing up…"}
                      </p>
                    </div>
                  ) : (
                    <img
                      src={showOriginalPhoto ? rawPhotoUrl : capturedDataUrl}
                      alt={showOriginalPhoto ? "Original photo" : "Retouched photo"}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}

                  {/* Before / After toggle — top-left */}
                  {rawPhotoUrl && !enhancingPhoto && (
                    <div className="absolute top-3 left-3 z-10 flex overflow-hidden rounded-xl border border-white/20 shadow-lg">
                      <button
                        onClick={() => setShowOriginalPhoto(false)}
                        className={`px-3 py-1 text-[10px] font-semibold transition ${
                          !showOriginalPhoto ? "bg-blue-600 text-white" : "bg-black/70 text-white/60"
                        }`}
                      >
                        Retouched
                      </button>
                      <button
                        onClick={() => setShowOriginalPhoto(true)}
                        className={`px-3 py-1 text-[10px] font-semibold transition ${
                          showOriginalPhoto ? "bg-blue-600 text-white" : "bg-black/70 text-white/60"
                        }`}
                      >
                        Original
                      </button>
                    </div>
                  )}

                  {/* Quality overlay — bottom gradient */}
                  {!enhancingPhoto && (
                    <div className="absolute bottom-0 inset-x-0 rounded-b-3xl bg-gradient-to-t from-black/80 to-transparent px-3 py-4">
                      {analyzingPhoto ? (
                        <p className="text-center text-xs text-white/70">Analyzing quality…</p>
                      ) : photoAnalysis ? (
                        <div className="text-center">
                          <span className={`inline-block rounded-lg px-3 py-1 text-xs font-bold ${
                            photoAnalysis.quality.status === "PASSED"
                              ? "bg-green-600/40 text-green-300"
                              : photoAnalysis.quality.status === "WARN"
                                ? "bg-amber-600/40 text-amber-300"
                                : "bg-red-600/40 text-red-300"
                          }`}>
                            {photoAnalysis.quality.status} · Score {photoAnalysis.quality.score ?? "--"}
                          </span>
                          {photoAnalysis.quality.warnings.length ? (
                            <p className="mt-1 text-[10px] text-amber-300">{photoAnalysis.quality.warnings[0]}</p>
                          ) : (
                            <p className="mt-1 text-[10px] text-green-400">Ready for ID card printing</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* Action buttons — match photo container width */}
                <div className="flex w-full flex-col gap-3" style={{ maxWidth: 420 }}>
                  {/* Primary CTA — go to review */}
                  {!enhancingPhoto && capturedDataUrl && (
                    <button
                      onClick={continueToReview}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl
                                 bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] py-3.5 text-sm font-bold
                                 text-white shadow-lg shadow-blue-900/30 transition"
                    >
                      <ChevronRight size={16} /> Use This Photo — Continue
                    </button>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setCapturedDataUrl(""); setRawPhotoUrl(""); setPhotoAnalysis(null); setShowPhotoTips(false); void startCamera(); }}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl
                                 border border-[var(--line-soft)] py-3 text-sm font-medium transition hover-glow"
                    >
                      <Camera size={15} /> Retake
                    </button>
                    {sessionContext.submissionModel.allowPhotoUpload && (
                      <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl
                                        border border-[var(--line-soft)] py-3 text-sm font-medium transition hover-glow">
                        <Upload size={15} /> Upload
                        <input type="file" accept="image/png,image/jpeg"
                          onChange={(e) => void handlePhotoUpload(e)} className="hidden" />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            ) : !showPhotoTips ? (
              /* ── Advanced AI camera ── */
              <div className="flex flex-col items-center">
                <AdvancedCamera
                  onCapture={async (result: CaptureResult) => {
                    setRawPhotoUrl(result.dataUrl);
                    setShowOriginalPhoto(false);
                    stopCamera();
                    setEnhancingPhoto(true);
                    setError("");
                    setPhotoAnalysis(null);
                    try {
                      let enhanced = result.dataUrl;
                      setStatus("Step 1/2 — Tone & sharpness…");
                      try { enhanced = await enhancePhotoForPrint(result.dataUrl, photoBackgroundPreference); } catch {}
                      setStatus("Step 2/2 — Face polish & enhance…");
                      try { enhanced = await applyFaceRetouch(enhanced); } catch {}
                      setCapturedDataUrl(enhanced);
                      setStatus("");
                      void analyzeCapturedPhoto(enhanced);
                    } finally {
                      setEnhancingPhoto(false);
                    }
                  }}
                  onCancel={undefined}
                  captureWidth={720}
                  captureHeight={960}
                />
                {sessionContext.submissionModel.allowPhotoUpload && (
                  <label className="mt-3 inline-flex items-center gap-2 cursor-pointer
                                    text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
                    <Upload size={13} /> Or upload a photo instead
                    <input type="file" accept="image/png,image/jpeg"
                      onChange={(e) => void handlePhotoUpload(e)} className="hidden" />
                  </label>
                )}
              </div>
            ) : null}
            {/* ── hidden canvas used by analyzePhoto helper ── */}
            <canvas ref={captureCanvasRef} className="hidden" />
            <div className="mt-3">
              <button
                onClick={() => { stopCamera(); setStep("details"); }}
                className="w-full rounded-xl border border-[var(--line-soft)] px-3 py-2 text-xs"
              >
                Back
              </button>
            </div>
          </section>
        ) : null}

        {step === "review" && sessionContext ? (
          <section className="glass rounded-2xl p-4">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-base font-bold text-gray-100">Step 5: Final Review</p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">Check all details carefully before submitting</p>
              </div>
              {photoAnalysis && !analyzingPhoto && (
                <span className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${
                  photoAnalysis.quality.status === "PASSED"
                    ? "border-green-500/30 bg-green-500/20 text-green-400"
                    : photoAnalysis.quality.status === "WARN"
                      ? "border-amber-500/30 bg-amber-500/20 text-amber-400"
                      : "border-red-500/30 bg-red-500/20 text-red-400"
                }`}>
                  {photoAnalysis.quality.status}
                  {photoAnalysis.quality.score ? ` · ${photoAnalysis.quality.score}` : ""}
                </span>
              )}
              {analyzingPhoto && (
                <span className="rounded-xl border border-[var(--line-soft)] px-3 py-1.5 text-xs text-[var(--text-muted)]">
                  Checking quality…
                </span>
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
              {/* Photo column */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative w-full max-w-[200px] overflow-hidden rounded-2xl border border-[var(--line-soft)] shadow-xl">
                  <img src={capturedDataUrl} alt="Student photo" className="w-full object-cover" />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2 text-center text-[10px] font-semibold text-emerald-300">
                    Print-ready · Enhanced
                  </div>
                </div>
                <button
                  onClick={() => { setError(""); setStatus(""); setShowPhotoTips(false); setStep("photo"); void startCamera(); }}
                  className="w-full rounded-xl border border-[var(--line-soft)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
                >
                  <Camera size={11} className="mr-1 inline" /> Retake photo
                </button>
              </div>

              {/* Details column */}
              <div className="space-y-3">
                {/* Student details card */}
                <div className="rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-soft)] p-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                    Student Details
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <ReviewField label={actorType === "PARENT" ? "Student Name" : "Name"} value={draft.fullName} />
                    {showParentName && <ReviewField label="Parent Name" value={draft.parentName} />}
                    {showClassName && <ReviewField label={primaryLabel} value={fixedPrimaryValue || draft.className} />}
                    {showDivision && <ReviewField label={secondaryLabel || "Division"} value={fixedSecondaryValue || draft.division} />}
                    {showRollNumber && <ReviewField label="Roll No." value={draft.rollNumber} />}
                    {showMobile && <ReviewField label="Mobile" value={draft.mobile || verifiedMobile} verified />}
                    {showDob && <ReviewField label="Date of Birth" value={draft.dob} />}
                    {showBloodGroup && <ReviewField label="Blood Group" value={draft.bloodGroup} />}
                    {showAadhaarNumber && <ReviewField label="Aadhaar" value={draft.aadhaarNumber ? `XXXX-XXXX-${draft.aadhaarNumber.slice(-4)}` : "--"} />}
                    {showEmergencyNumber && <ReviewField label="Emergency No." value={draft.emergencyNumber} />}
                  </div>
                  {showAddress && draft.address && (
                    <div className="mt-3 border-t border-[var(--line-soft)] pt-2">
                      <p className="text-[10px] text-[var(--text-muted)]">Address</p>
                      <p className="mt-0.5 text-xs">{draft.address}</p>
                    </div>
                  )}
                  <button
                    onClick={() => { setError(""); setStatus(""); setStep("details"); }}
                    className="mt-3 text-[10px] text-blue-400 transition hover:text-blue-300"
                  >
                    Edit details
                  </button>
                </div>

                {/* Institution */}
                <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-soft)] px-3 py-2 text-xs text-[var(--text-muted)]">
                  <p className="font-medium text-[var(--text-primary)]">{sessionContext.link.school.name}</p>
                  <p className="mt-0.5">{sessionContext.link.campaignName}{segmentLabel ? ` · ${segmentLabel}` : ""}</p>
                </div>

                {/* Quality warnings */}
                {photoAnalysis?.quality.warnings.length ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                    <p className="font-semibold">Photo Warnings</p>
                    {photoAnalysis.quality.warnings.map((w) => (
                      <p key={w} className="mt-0.5">• {w}</p>
                    ))}
                  </div>
                ) : null}

                {/* Submit */}
                <button
                  onClick={() => void submitIntake()}
                  disabled={enhancingPhoto || submitting || !capturedDataUrl}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl
                             bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] py-3.5 text-sm font-bold
                             text-white shadow-lg shadow-blue-900/30 transition disabled:opacity-60"
                >
                  <ShieldCheck size={16} />
                  {submitting ? "Saving record…" : "Submit Intake Record"}
                </button>
                {submissionModel.workflowRequired && (
                  <p className="text-center text-[10px] text-[var(--text-muted)]">
                    Record will be placed in review queue after submission.
                  </p>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {step === "done" ? (
          <section className="glass rounded-2xl p-6 text-center">
            {/* Success icon */}
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full
                            border border-green-500/30 bg-gradient-to-br from-green-500/20 to-emerald-500/20">
              <CheckCircle2 size={32} className="text-green-400" />
            </div>
            <p className="text-xl font-bold text-gray-100">Submission Complete!</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {draft.fullName ? `${draft.fullName}'s` : "The"} intake record has been saved successfully.
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              Linked to verified mobile: {maskMobile(verifiedMobile)}
            </p>

            <div className="mx-auto mt-6 flex max-w-xs flex-col gap-3">
              {/* Add sibling — primary CTA */}
              <button
                onClick={resetForSibling}
                className="flex w-full items-center justify-center gap-2 rounded-2xl
                           bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-4 py-3
                           text-sm font-bold text-white shadow-lg shadow-blue-900/30 transition"
              >
                <Users size={16} /> Add Another Student (Sibling)
              </button>

              {/* New student / different family */}
              <button
                onClick={resetForNext}
                className="flex w-full items-center justify-center gap-2 rounded-2xl
                           border border-[var(--line-soft)] px-4 py-3 text-sm font-medium
                           text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
              >
                <Plus size={16} /> New Student Record
              </button>
            </div>

            <p className="mt-4 text-[10px] text-[var(--text-muted)]">
              <strong>Sibling</strong> keeps the same verified mobile and pre-fills parent info.{" "}
              <strong>New Student Record</strong> starts a fresh form.
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function PortalLoading() {
  return (
    <main className="min-h-screen bg-[var(--bg-base)] p-6 text-[var(--text-primary)]">
      <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-soft)] p-6">
        <p className="text-sm text-[var(--text-muted)]">Loading intake portal...</p>
      </div>
    </main>
  );
}

function getPortalHeading(actorType: ActorType) {
  if (actorType === "STUDENT") return "Student Intake Portal";
  if (actorType === "STAFF") return "Staff Intake Portal";
  return "Parent Intake Portal";
}

function getActorMessage(actorType: ActorType) {
  if (actorType === "STUDENT") return "Verify the student mobile number to begin this intake.";
  if (actorType === "STAFF") return "Verify the staff mobile number to begin this intake.";
  return "Verify the parent mobile number to begin this intake.";
}

function getMobilePlaceholder(actorType: ActorType) {
  if (actorType === "STUDENT") return "10-digit student mobile";
  if (actorType === "STAFF") return "10-digit staff mobile";
  return "10-digit parent mobile";
}

function readDraftValue(draft: Record<string, unknown> | undefined, key: string) {
  const value = draft?.[key];
  return typeof value === "string" ? value : "";
}

function normalizeSegmentValue(value?: string | null) {
  const normalized = (value || "").trim();
  if (!normalized) return "";
  const lowered = normalized.toLowerCase();
  if (["na", "n/a", "null", "undefined", "-", "--"].includes(lowered)) return "";
  return normalized;
}

function normalizeFixedSegment(value?: string | null) {
  const normalized = normalizeSegmentValue(value);
  return normalized.toLowerCase() === "all" ? "" : normalized;
}

function normalizeMobile(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 ? digits : "";
}

function normalizeAadhaar(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 12 ? digits : "";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getPassportCropRect(
  width: number,
  height: number,
  focus?: { x: number; y: number; width: number; height: number } | null
) {
  const targetRatio = 3.5 / 4.5;
  let cropWidth = width;
  let cropHeight = Math.round(cropWidth / targetRatio);

  if (cropHeight > height) {
    cropHeight = height;
    cropWidth = Math.round(cropHeight * targetRatio);
  }

  const centerX = focus ? focus.x + focus.width / 2 : width / 2;
  const centerY = focus ? focus.y + focus.height / 2 : height / 2;
  const sx = clamp(Math.round(centerX - cropWidth / 2), 0, Math.max(width - cropWidth, 0));
  const sy = clamp(Math.round(centerY - cropHeight / 2), 0, Math.max(height - cropHeight, 0));

  return {
    sx,
    sy,
    sw: cropWidth,
    sh: cropHeight
  };
}

async function cropImageDataUrlToPassport(dataUrl: string) {
  const image = await loadImageDataUrl(dataUrl);
  const crop = getPassportCropRect(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const canvas = document.createElement("canvas");
  canvas.width = crop.sw;
  canvas.height = crop.sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, crop.sw, crop.sh);
  return canvas.toDataURL("image/jpeg", 0.92);
}

function loadImageDataUrl(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load image for cropping"));
    image.src = dataUrl;
  });
}

/**
 * 4-pass face retouch — targets professional studio passport quality.
 *
 * Pass 1  — Global tone: brightness / contrast / saturation via CSS filter
 *           applied during the upscale draw (free GPU-accelerated pass).
 * Pass 2  — Bilateral-style edge-preserving noise reduction: averages only
 *           neighbours whose colour is within NR_THR of the centre pixel,
 *           preserving hair/eye edges while smoothing skin noise.
 * Pass 3  — Unsharp mask: box-blur then amplify the high-frequency residual
 *           (SHARP × (NR − blur)), giving crisp edges without halos.
 * Pass 4  — Kelvin colour temperature shift: phone sensors default to ~6 000 K
 *           (daylight/overcast).  We shift to ~4 800 K (studio tungsten flash)
 *           by adding R +12, G +4, B −18.  Pure-white pixels are skipped so
 *           the removed background stays neutral white.
 *
 * Output is upscaled to TARGET_LONG = 2 400 px on the long edge (≈4 K print
 * quality at 300 DPI passport size) and encoded as JPEG 0.91 — which gives
 * ~30 % smaller files than 0.95 with no visible quality loss.
 */
function applyFaceRetouch(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // ── Pass 1: Upscale + global tone ───────────────────────────────────
      const TARGET_LONG = 2400;
      const srcLong = Math.max(img.width, img.height);
      const upscale = srcLong < TARGET_LONG ? TARGET_LONG / srcLong : 1;
      const W = Math.round(img.width  * upscale);
      const H = Math.round(img.height * upscale);

      const canvas = document.createElement("canvas");
      canvas.width  = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      // Subtle global tone — keep it close to natural, no heavy saturation boost
      ctx.filter = "brightness(1.03) contrast(1.08) saturate(1.05)";
      ctx.drawImage(img, 0, 0, W, H);
      ctx.filter = "none";

      const imgData = ctx.getImageData(0, 0, W, H);
      const src = imgData.data;

      // ── Pass 2: Bilateral-style noise reduction ──────────────────────────
      // NR_THR = 30: include neighbours with similar colour (edge-preserving)
      // Blend: 50 % original + 50 % filtered → smooth noise without smearing edges
      const NR_THR = 30;
      const nr = new Uint8ClampedArray(src);
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const pi = (y * W + x) * 4;
          for (let ch = 0; ch < 3; ch++) {
            const cv = src[pi + ch];
            let sum = cv, cnt = 1;
            for (let ny2 = -1; ny2 <= 1; ny2++) {
              for (let nx2 = -1; nx2 <= 1; nx2++) {
                if (nx2 === 0 && ny2 === 0) continue;
                const ni = ((y + ny2) * W + (x + nx2)) * 4;
                if (Math.abs(src[ni + ch] - cv) <= NR_THR) { sum += src[ni + ch]; cnt++; }
              }
            }
            nr[pi + ch] = Math.round(cv * 0.5 + (sum / cnt) * 0.5);
          }
        }
      }

      // ── Pass 3: Unsharp mask ─────────────────────────────────────────────
      const BLR = 1;      // tighter blur radius = finer detail sharpening
      const SHARP = 1.2;  // reduced from 2.0 — crisp without artificial edge halos
      const blurred = new Uint8ClampedArray(nr);
      const tmp     = new Uint8ClampedArray(nr);

      // Horizontal box-blur pass
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const pi = (y * W + x) * 4;
          for (let ch = 0; ch < 3; ch++) {
            let s = 0, c = 0;
            for (let dx = -BLR; dx <= BLR; dx++) {
              s += nr[(y * W + Math.max(0, Math.min(W - 1, x + dx))) * 4 + ch]; c++;
            }
            tmp[pi + ch] = s / c;
          }
        }
      }
      // Vertical box-blur pass
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const pi = (y * W + x) * 4;
          for (let ch = 0; ch < 3; ch++) {
            let s = 0, c = 0;
            for (let dy = -BLR; dy <= BLR; dy++) {
              s += tmp[(Math.max(0, Math.min(H - 1, y + dy)) * W + x) * 4 + ch]; c++;
            }
            blurred[pi + ch] = s / c;
          }
        }
      }

      // ── Pass 4: Unsharp mask apply + Kelvin warm shift ──────────────────
      // Kelvin: phone ~6 000 K → studio ~4 800 K (R +12, G +4, B −18)
      const out = new Uint8ClampedArray(src.length);
      for (let i = 0; i < src.length; i += 4) {
        const r = Math.round(nr[i]     + SHARP * (nr[i]     - blurred[i]));
        const g = Math.round(nr[i + 1] + SHARP * (nr[i + 1] - blurred[i + 1]));
        const b = Math.round(nr[i + 2] + SHARP * (nr[i + 2] - blurred[i + 2]));
        // Kelvin: gentle warm shift — phone ~6 000 K → ~5 200 K (natural daylight)
        out[i]     = Math.min(255, Math.max(0, r + 5));
        out[i + 1] = Math.min(255, Math.max(0, g + 1));
        out[i + 2] = Math.min(255, Math.max(0, b - 7));
        out[i + 3] = 255;
      }

      ctx.putImageData(new ImageData(out, W, H), 0, 0);
      // JPEG 0.91 — ~30% smaller than 0.95, no visible quality difference at 4K
      resolve(canvas.toDataURL("image/jpeg", 0.91));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/** Compact field display for the review step. */
function ReviewField({ label, value, verified }: { label: string; value: string; verified?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-[var(--text-muted)]">{label}</p>
      <p className="text-xs font-medium text-[var(--text-primary)]">
        {value || "--"}
        {verified && <span className="ml-1 text-[9px] text-emerald-400">✓ verified</span>}
      </p>
    </div>
  );
}


async function enhancePhotoForPrint(dataUrl: string, backgroundPreference: string) {
  const image = await loadImageDataUrl(dataUrl);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const sourceLongerEdge = Math.max(sourceWidth, sourceHeight);
  const processingScale =
    sourceLongerEdge > MAX_PRINT_PROCESSING_EDGE ? MAX_PRINT_PROCESSING_EDGE / sourceLongerEdge : 1;
  const width = Math.max(1, Math.round(sourceWidth * processingScale));
  const height = Math.max(1, Math.round(sourceHeight * processingScale));
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const ctx = sourceCanvas.getContext("2d");
  if (!ctx) return dataUrl;

  ctx.drawImage(image, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const working = new Uint8ClampedArray(imageData.data);
  const bgStats = samplePlainBackground(working, width, height);
  applyPrintToneCorrection(working, width, height);
  if (shouldNormalizeBackground(backgroundPreference, bgStats.variance)) {
    normalizePlainBackgroundToWhite(working, width, height, bgStats);
  }
  const sharpened = applyMildSharpen(working, width, height);
  imageData.data.set(sharpened);
  ctx.putImageData(imageData, 0, 0);

  const shorterEdge = Math.min(width, height);
  const exportScale = shorterEdge < MIN_PRINT_EXPORT_EDGE ? MIN_PRINT_EXPORT_EDGE / shorterEdge : 1;
  if (exportScale <= 1) {
    return sourceCanvas.toDataURL("image/jpeg", 0.94);
  }

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = Math.round(width * exportScale);
  exportCanvas.height = Math.round(height * exportScale);
  const exportCtx = exportCanvas.getContext("2d");
  if (!exportCtx) {
    return sourceCanvas.toDataURL("image/jpeg", 0.94);
  }

  exportCtx.imageSmoothingEnabled = true;
  exportCtx.imageSmoothingQuality = "high";
  exportCtx.drawImage(sourceCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
  return exportCanvas.toDataURL("image/jpeg", 0.94);
}

function samplePlainBackground(data: Uint8ClampedArray, width: number, height: number) {
  let r = 0;
  let g = 0;
  let b = 0;
  let brightnessSum = 0;
  let brightnessSquares = 0;
  let count = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const edgePixel =
        x < width * 0.15 || x > width * 0.85 || y < height * 0.15 || y > height * 0.85;
      if (!edgePixel) continue;
      const offset = (y * width + x) * 4;
      const pr = data[offset];
      const pg = data[offset + 1];
      const pb = data[offset + 2];
      const luminance = 0.2126 * pr + 0.7152 * pg + 0.0722 * pb;
      r += pr;
      g += pg;
      b += pb;
      brightnessSum += luminance;
      brightnessSquares += luminance * luminance;
      count += 1;
    }
  }

  const avgBrightness = count ? brightnessSum / count : 0;
  const variance = count ? brightnessSquares / count - avgBrightness * avgBrightness : 0;
  return {
    r: count ? r / count : 255,
    g: count ? g / count : 255,
    b: count ? b / count : 255,
    variance
  };
}

function shouldNormalizeBackground(preference: string, variance: number) {
  const normalized = (preference || "NONE").toUpperCase();
  if (normalized === "NONE") return false;
  if (normalized === "PLAIN") return variance <= 1800;
  if (normalized === "WHITE") return variance <= 1600;
  if (normalized === "LIGHT") return variance <= 2000;
  return variance <= 1900;
}

function applyPrintToneCorrection(data: Uint8ClampedArray, width: number, height: number) {
  const centerLuma = sampleCenterLuminance(data, width, height);
  const brightnessBoost = centerLuma < 146 ? Math.min(24, (146 - centerLuma) * 0.24) : 4;
  const contrast = 1.06;
  for (let index = 0; index < data.length; index += 4) {
    data[index] = toneAdjustChannel(data[index], brightnessBoost, contrast);
    data[index + 1] = toneAdjustChannel(data[index + 1], brightnessBoost, contrast);
    data[index + 2] = toneAdjustChannel(data[index + 2], brightnessBoost, contrast);
  }
}

function sampleCenterLuminance(data: Uint8ClampedArray, width: number, height: number) {
  const startX = Math.floor(width * 0.22);
  const endX = Math.ceil(width * 0.78);
  const startY = Math.floor(height * 0.18);
  const endY = Math.ceil(height * 0.82);
  let sum = 0;
  let count = 0;
  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const offset = (y * width + x) * 4;
      sum += 0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2];
      count += 1;
    }
  }
  return count ? sum / count : 140;
}

function toneAdjustChannel(value: number, brightnessBoost: number, contrast: number) {
  return clamp(Math.round((value - 128) * contrast + 128 + brightnessBoost), 0, 255);
}

function normalizePlainBackgroundToWhite(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  background: { r: number; g: number; b: number; variance: number }
) {
  const strongThreshold = 44;
  const softThreshold = 86;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const distance = colorDistance(data[offset], data[offset + 1], data[offset + 2], background);
      if (distance > softThreshold) continue;
      const edgeWeight = edgeBlendWeight(x, y, width, height);
      const centerProtection = centerProtectionWeight(x, y, width, height);
      const baseBlend =
        distance <= strongThreshold
          ? 0.88
          : 0.88 * (1 - (distance - strongThreshold) / (softThreshold - strongThreshold));
      const blend = clamp(baseBlend * edgeWeight * centerProtection, 0, 0.92);
      if (blend <= 0) continue;
      data[offset] = blendTowardsWhite(data[offset], blend);
      data[offset + 1] = blendTowardsWhite(data[offset + 1], blend);
      data[offset + 2] = blendTowardsWhite(data[offset + 2], blend);
    }
  }
}

function colorDistance(
  r: number,
  g: number,
  b: number,
  background: { r: number; g: number; b: number }
) {
  const dr = r - background.r;
  const dg = g - background.g;
  const db = b - background.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function edgeBlendWeight(x: number, y: number, width: number, height: number) {
  const left = x / width;
  const right = (width - x) / width;
  const top = y / height;
  const bottom = (height - y) / height;
  const nearestEdge = Math.min(left, right, top, bottom);
  if (nearestEdge <= 0.12) return 1;
  if (nearestEdge <= 0.2) return 0.82;
  if (nearestEdge <= 0.28) return 0.58;
  return 0.28;
}

function centerProtectionWeight(x: number, y: number, width: number, height: number) {
  const nx = (x - width / 2) / (width * 0.28);
  const ny = (y - height / 2) / (height * 0.34);
  const ellipse = nx * nx + ny * ny;
  if (ellipse <= 0.72) return 0.08;
  if (ellipse <= 1.15) return 0.28;
  return 1;
}

function blendTowardsWhite(value: number, blend: number) {
  return clamp(Math.round(value + (255 - value) * blend), 0, 255);
}

function applyMildSharpen(data: Uint8ClampedArray, width: number, height: number) {
  const source = new Uint8ClampedArray(data);
  const output = new Uint8ClampedArray(data);
  const kernel = [
    0,
    -0.6,
    0,
    -0.6,
    3.4,
    -0.6,
    0,
    -0.6,
    0
  ];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      for (let channel = 0; channel < 3; channel += 1) {
        let sum = 0;
        let kernelIndex = 0;
        for (let ky = -1; ky <= 1; ky += 1) {
          for (let kx = -1; kx <= 1; kx += 1) {
            const offset = ((y + ky) * width + (x + kx)) * 4 + channel;
            sum += source[offset] * kernel[kernelIndex];
            kernelIndex += 1;
          }
        }
        output[(y * width + x) * 4 + channel] = clamp(Math.round(sum), 0, 255);
      }
    }
  }
  return output;
}

function maskMobile(value: string) {
  const digits = normalizeMobile(value);
  if (!digits) return value;
  return `${digits.slice(0, 2)}******${digits.slice(-2)}`;
}

function buildSegmentLabel(
  institutionType: PublicLinkMeta["institutionType"] | SessionContext["link"]["institutionType"] | undefined,
  primaryValue: string,
  secondaryValue: string
) {
  if (!primaryValue) return "";
  if (institutionType === "COLLEGE") {
    return secondaryValue ? `${primaryValue} - Year ${secondaryValue}` : primaryValue;
  }
  return secondaryValue ? `Class ${primaryValue} - Division ${secondaryValue}` : `Class ${primaryValue}`;
}

function sanitizeSegmentLabel(value?: string | null) {
  const normalized = normalizeSegmentValue(value);
  if (!normalized) return "";
  if (normalized.toLowerCase().includes("pending")) return "";
  if (normalized.toUpperCase().includes(" ALL")) return "";
  return normalized;
}

function resolveBgColor(mode: string) {
  const normalized = mode.toUpperCase();
  if (normalized === "WHITE") return "#ffffff";
  if (normalized === "LIGHT_BLUE") return "#d8e9ff";
  if (normalized === "LIGHT_GRAY") return "#e7e7e7";
  return "transparent";
}

function sampleVideoFrameMetrics(video: HTMLVideoElement) {
  const canvas = document.createElement("canvas");
  canvas.width = 120;
  canvas.height = 80;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      brightness: 0,
      edgeBrightness: 0,
      edgeVariance: 0
    };
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let totalBrightnessSum = 0;
  let edgeSum = 0;
  let edgeSumSquares = 0;
  let edgeCount = 0;
  for (let index = 0; index < data.length; index += 4) {
    totalBrightnessSum += 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
  }
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const isEdge =
        x < canvas.width * 0.18 ||
        x > canvas.width * 0.82 ||
        y < canvas.height * 0.18 ||
        y > canvas.height * 0.82;
      if (!isEdge) continue;
      const offset = (y * canvas.width + x) * 4;
      const brightness = 0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2];
      edgeSum += brightness;
      edgeSumSquares += brightness * brightness;
      edgeCount += 1;
    }
  }
  const edgeMean = edgeCount ? edgeSum / edgeCount : 0;
  return {
    brightness: totalBrightnessSum / (data.length / 4),
    edgeBrightness: edgeMean,
    edgeVariance: edgeCount ? edgeSumSquares / edgeCount - edgeMean * edgeMean : 0
  };
}

function analyzeFallbackFace(video: HTMLVideoElement) {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 120;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { faceDetected: false, faceCentered: false, distanceGood: false };
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const startX = Math.floor(canvas.width * 0.24);
  const endX = Math.ceil(canvas.width * 0.76);
  const startY = Math.floor(canvas.height * 0.14);
  const endY = Math.ceil(canvas.height * 0.86);

  let skinCount = 0;
  let total = 0;
  let luminanceSum = 0;
  let luminanceSquares = 0;
  let gradientSum = 0;
  let centroidX = 0;
  let centroidY = 0;

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const offset = (y * canvas.width + x) * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      luminanceSum += luminance;
      luminanceSquares += luminance * luminance;
      total += 1;

      const skinRgb =
        r > 88 &&
        g > 36 &&
        b > 16 &&
        Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
        Math.abs(r - g) > 8 &&
        r > g &&
        r > b;
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      const skinYcc = cb >= 76 && cb <= 132 && cr >= 132 && cr <= 176;
      if (skinRgb && skinYcc) {
        skinCount += 1;
        centroidX += x;
        centroidY += y;
      }

      if (x < endX - 1 && y < endY - 1) {
        const right = (y * canvas.width + (x + 1)) * 4;
        const down = ((y + 1) * canvas.width + x) * 4;
        const rightL = 0.2126 * data[right] + 0.7152 * data[right + 1] + 0.0722 * data[right + 2];
        const downL = 0.2126 * data[down] + 0.7152 * data[down + 1] + 0.0722 * data[down + 2];
        gradientSum += Math.abs(luminance - rightL) + Math.abs(luminance - downL);
      }
    }
  }

  if (!total) {
    return { faceDetected: false, faceCentered: false, distanceGood: false };
  }

  const skinRatio = skinCount / total;
  const mean = luminanceSum / total;
  const variance = luminanceSquares / total - mean * mean;
  const gradient = gradientSum / total;
  const faceDetected = skinRatio >= 0.06 && skinRatio <= 0.62 && variance >= 240 && gradient >= 9;
  if (!faceDetected || !skinCount) {
    return { faceDetected: false, faceCentered: false, distanceGood: false };
  }

  const centerX = centroidX / skinCount;
  const centerY = centroidY / skinCount;
  const guideCenterX = (startX + endX) / 2;
  const guideCenterY = (startY + endY) / 2;
  const faceCentered =
    Math.abs(centerX - guideCenterX) <= (endX - startX) * 0.18 &&
    Math.abs(centerY - guideCenterY) <= (endY - startY) * 0.2;
  const distanceGood = skinRatio >= 0.11 && skinRatio <= 0.46;

  return { faceDetected, faceCentered, distanceGood };
}

function isBackgroundReady(preference: string, edgeBrightness: number, edgeVariance: number) {
  const normalized = (preference || "NONE").toUpperCase();
  if (normalized === "PLAIN") return edgeVariance <= 2600;
  if (normalized === "NONE") return edgeVariance <= 2100;
  if (normalized === "WHITE") return edgeBrightness >= 118 && edgeVariance <= 1400;
  if (normalized === "LIGHT") return edgeBrightness >= 105 && edgeVariance <= 1700;
  return edgeBrightness >= 85 && edgeVariance <= 1900;
}

function isBackgroundBlocking(preference: string, backgroundGood: boolean, edgeVariance: number) {
  const normalized = (preference || "NONE").toUpperCase();
  if (normalized === "NONE") return false;
  if (normalized === "PLAIN") return edgeVariance > 4200;
  return !backgroundGood;
}

function backgroundGuidance(preference: string) {
  const normalized = (preference || "NONE").toUpperCase();
  if (normalized === "PLAIN") return "Use any plain, uncluttered background behind the face.";
  if (normalized === "WHITE") return "Use a plain white or very light background.";
  if (normalized === "LIGHT") return "Use a clean light background behind the face.";
  if (normalized === "NONE") return "Keep the background plain and uncluttered.";
  return `Use a clean ${normalized.toLowerCase()} background.`;
}

function Field({
  value,
  onChange,
  placeholder,
  type = "text"
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
    />
  );
}

function ReadonlyField({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: "verified";
}) {
  return (
    <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-soft)] px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="block text-[11px] text-[var(--text-muted)]">{label}</span>
        {tone === "verified" ? <Badge text="Verified" /> : null}
      </div>
      <p className="m-0 mt-1 text-sm font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function Badge({ text }: { text: string }) {
  return (
    <span className="rounded-full border border-[var(--line-soft)] px-3 py-1 text-[11px] text-[var(--text-muted)]">
      {text}
    </span>
  );
}

// ── Photo Tips Screen ─────────────────────────────────────────────────────────

function PhotoTipsScreen({ onOpenCamera }: { onOpenCamera: () => void }) {
  const dos = [
    { icon: "☀️", text: "Face a bright light source (window or lamp in front of you)" },
    { icon: "🏠", text: "Use a plain, uncluttered wall behind you" },
    { icon: "👀", text: "Look straight at the camera — eyes open, neutral expression" },
    { icon: "📱", text: "Hold the phone at eye level, arm's length away" },
  ];
  const donts = [
    { icon: "🚫", text: "No backlight — don't stand with a window behind you" },
    { icon: "🕶️", text: "Remove glasses, caps, or face coverings" },
    { icon: "🌑", text: "Avoid dark or crowded backgrounds" },
    { icon: "🤳", text: "Don't tilt or rotate the phone sideways" },
  ];

  return (
    <div className="flex flex-col gap-5 py-2">

      {/* Sample photo illustration */}
      <div className="flex items-center justify-center gap-4">
        {/* Good example */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex h-28 w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-green-500/50 bg-gradient-to-b from-sky-100/10 to-sky-50/5 shadow-md shadow-green-500/10">
            <div className="h-10 w-10 rounded-full bg-amber-300/80 shadow-inner" style={{ boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)" }} />
            <div className="h-5 w-14 rounded-t-full bg-amber-300/60" />
          </div>
          <span className="flex items-center gap-1 text-[10px] font-semibold text-green-400">
            <span>✓</span> Good
          </span>
        </div>

        <div className="text-2xl text-gray-600">vs</div>

        {/* Bad example */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex h-28 w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-red-500/40 bg-gradient-to-b from-orange-900/30 to-brown-900/20 shadow-md shadow-red-500/10"
               style={{ background: "linear-gradient(160deg,#3a2010 0%,#1a0a05 100%)" }}>
            <div className="h-8 w-8 rounded-full bg-amber-600/60 opacity-50" />
            <div className="h-4 w-12 rounded-t-full bg-amber-600/40 opacity-50" />
          </div>
          <span className="flex items-center gap-1 text-[10px] font-semibold text-red-400">
            <span>✗</span> Dark / cluttered
          </span>
        </div>
      </div>

      {/* Do's and Don'ts */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-green-400">Do</p>
          {dos.map((item, i) => (
            <div key={i} className="flex items-start gap-2 rounded-xl border border-green-500/20 bg-green-500/5 px-3 py-2">
              <span className="text-base leading-none">{item.icon}</span>
              <p className="text-[11px] text-[var(--text-primary)] leading-snug">{item.text}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-red-400">Don't</p>
          {donts.map((item, i) => (
            <div key={i} className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2">
              <span className="text-base leading-none">{item.icon}</span>
              <p className="text-[11px] text-[var(--text-primary)] leading-snug">{item.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tip callout */}
      <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/8 px-3 py-2.5">
        <span className="text-lg leading-none">💡</span>
        <p className="text-[11px] text-amber-200 leading-snug">
          <strong>Tip:</strong> Use the <strong>back camera</strong> with flash for best results — it has a higher-quality sensor than the selfie camera and the flash ensures even lighting even indoors.
        </p>
      </div>

      {/* CTA */}
      <button
        onClick={onOpenCamera}
        className="flex w-full items-center justify-center gap-2 rounded-2xl
                   bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] py-4 text-sm
                   font-bold text-white shadow-lg shadow-blue-900/30 transition active:scale-[0.98]"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
        I'm Ready — Open Camera
      </button>
    </div>
  );
}

function GuidanceRow({ label, ready, note }: { label: string; ready: boolean; note: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--line-soft)] px-2 py-2 text-[11px]">
      <div>
        <p className="m-0 font-medium text-[var(--text-primary)]">{label}</p>
        <p className="m-0 mt-1 text-[var(--text-muted)]">{note}</p>
      </div>
      <span
        className={`rounded-full border px-2 py-1 ${
          ready
            ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
            : "border-[var(--line-soft)] text-[var(--text-muted)]"
        }`}
      >
        {ready ? "Ready" : "Adjust"}
      </span>
    </div>
  );
}
