"use client";

import { motion } from "framer-motion";
import { Camera, CheckCircle2, ChevronRight, Save, ShieldCheck, Smartphone, Upload } from "lucide-react";
import { ChangeEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type Step = "auth" | "otp" | "details" | "photo" | "review" | "done";
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
const AUTO_CAPTURE_DELAY_MS = 220;
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

  const [step, setStep] = useState<Step>("auth");
  const [publicMeta, setPublicMeta] = useState<PublicLinkMeta | null>(null);
  const [sessionContext, setSessionContext] = useState<SessionContext | null>(null);
  const [sessionToken, setSessionToken] = useState("");
  const [authSessionId, setAuthSessionId] = useState("");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [guidance, setGuidance] = useState("Allow camera access and keep the face centered.");
  const [captureAssistant, setCaptureAssistant] = useState<CaptureAssistantState>(DEFAULT_CAPTURE_ASSISTANT);
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(true);
  const [autoCapturing, setAutoCapturing] = useState(false);
  const [captureStability, setCaptureStability] = useState(0);
  const [savedSubmissions, setSavedSubmissions] = useState(0);
  const [capturedDataUrl, setCapturedDataUrl] = useState("");
  const [photoAnalysis, setPhotoAnalysis] = useState<PhotoAnalysisState | null>(null);
  const [enhancingPhoto, setEnhancingPhoto] = useState(false);
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
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
  const autoCaptureTimerRef = useRef<number | null>(null);
  const captureReadyRef = useRef(false);
  const autoCaptureEnabledRef = useRef(true);
  const autoCapturingRef = useRef(false);
  const captureInFlightRef = useRef(false);
  const stableFrameCountRef = useRef(0);
  const stepRef = useRef<Step>("auth");

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
  const verifiedMobile = sessionContext?.session.verifiedMobile || mobile;
  const allowMobileEdit = Boolean(submissionModel.allowMobileEditAfterVerification);
  const configuredPhotoBackgroundPreference = (
    submissionModel.photoBgPreference ||
    sessionContext?.link.photoBgPreference ||
    publicMeta?.photoBgPreference ||
    "NONE"
  ).toUpperCase();
  const photoBackgroundPreference =
    configuredPhotoBackgroundPreference === "WHITE" ? "PLAIN" : configuredPhotoBackgroundPreference;

  const progressSteps = useMemo<Step[]>(() => ["auth", "otp", "details", "photo", "review", "done"], []);
  const progress = useMemo(() => {
    const index = Math.max(progressSteps.indexOf(step), 0);
    return ((index + 1) / progressSteps.length) * 100;
  }, [progressSteps, step]);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    autoCaptureEnabledRef.current = autoCaptureEnabled;
  }, [autoCaptureEnabled]);

  useEffect(() => {
    autoCapturingRef.current = autoCapturing;
  }, [autoCapturing]);

  useEffect(() => {
    if (tokenFromUrl) {
      void loadPublicEntry(tokenFromUrl);
    }
    return () => {
      stopCamera();
      if (autoCaptureTimerRef.current) window.clearTimeout(autoCaptureTimerRef.current);
      if (analysisTimerRef.current) window.clearInterval(analysisTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenFromUrl]);

  useEffect(() => {
    if (resendAt <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [resendAt]);

  async function loadPublicEntry(token: string) {
    setLoadingMeta(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/intake-links/token/${encodeURIComponent(token)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Invalid intake link");
      setPublicMeta(data as PublicLinkMeta);
      setStep("auth");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load intake link");
    } finally {
      setLoadingMeta(false);
    }
  }

  async function sendOtp() {
    if (!publicMeta?.token) {
      setError("Intake link not available");
      return;
    }
    const normalizedMobile = normalizeMobile(mobile);
    if (!normalizedMobile) {
      setError("Enter a valid 10-digit mobile number");
      return;
    }

    setSendingOtp(true);
    setError("");
    setStatus("");
    try {
      const res = await fetch(`${apiBase}/intake-links/auth/start-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intakeToken: publicMeta.token, mobile: normalizedMobile })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "OTP send failed");
      setMobile(normalizedMobile);
      setAuthSessionId(data.authSessionId);
      setResendAt(Date.now() + 30_000);
      setNow(Date.now());
      setStep("otp");
      setStatus(
        exposeDevOtp && data.devOtp
          ? `OTP sent. Dev OTP: ${data.devOtp}`
          : `OTP sent to ${data.maskedMobile || maskMobile(normalizedMobile)}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "OTP send failed");
    } finally {
      setSendingOtp(false);
    }
  }

  async function verifyOtp() {
    if (!authSessionId) {
      setError("Start mobile verification first");
      return;
    }

    setVerifyingOtp(true);
    setError("");
    setStatus("");
    try {
      const res = await fetch(`${apiBase}/intake-links/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authSessionId, otp })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "OTP verification failed");
      setSessionToken(data.intakeSessionToken);
      await loadSessionContext(data.intakeSessionToken);
      setStatus(`Mobile verified for ${data.maskedMobile || maskMobile(mobile)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "OTP verify failed");
    } finally {
      setVerifyingOtp(false);
    }
  }

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
        mobile: readDraftValue(ctx.draft, "mobile") || ctx.session.verifiedMobile,
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
      issues.push("Verified mobile number is required");
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

  function clearAutoCaptureTimer() {
    if (autoCaptureTimerRef.current) {
      window.clearTimeout(autoCaptureTimerRef.current);
      autoCaptureTimerRef.current = null;
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
    const autoCaptureSupported = next.guidanceMode !== "manual";

    if (!next.ready || !autoCaptureSupported || !autoCaptureEnabledRef.current || stepRef.current !== "photo") {
      clearAutoCaptureTimer();
      setAutoCapturing(false);
      autoCapturingRef.current = false;
      return;
    }

    if (autoCaptureTimerRef.current || autoCapturingRef.current) return;
    autoCaptureTimerRef.current = window.setTimeout(() => {
      autoCaptureTimerRef.current = null;
      if (!captureReadyRef.current || stepRef.current !== "photo") return;
      setAutoCapturing(true);
      autoCapturingRef.current = true;
      setStatus("Locked in. Capturing now.");
      void capturePhoto("auto");
    }, AUTO_CAPTURE_DELAY_MS);
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
    setStep("photo");
    await startCamera();
  }

  async function startCamera(preserveFeedback = false) {
    if (!preserveFeedback) {
      setError("");
      setStatus("");
    }
    clearAutoCaptureTimer();
    resetCaptureReadiness();
    setAutoCapturing(false);
    autoCapturingRef.current = false;
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
    clearAutoCaptureTimer();
    setAutoCapturing(false);
    autoCapturingRef.current = false;
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
                    ? "Plain background preferred, but you can continue. Hold steady for auto capture."
                    : stableFrameCount < CAPTURE_STABILITY_TARGET
                      ? `Hold steady for auto capture (${stableFrameCount}/${CAPTURE_STABILITY_TARGET})`
                      : "Face aligned. Auto capture is ready."
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
                : autoCaptureEnabledRef.current
                  ? "Hold steady. Auto capture is ready."
                  : "Face clear. Capture now."
    });
  }

  async function capturePhoto(trigger: "manual" | "auto" = "manual") {
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas) return;
    if (captureInFlightRef.current) return;
    if (trigger === "manual" && !captureReadyRef.current) {
      setError("Wait for face, lighting, and background guidance to turn ready before capturing.");
      return;
    }
    captureInFlightRef.current = true;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      captureInFlightRef.current = false;
      return;
    }

    clearAutoCaptureTimer();
    const crop = getPassportCropRect(video.videoWidth, video.videoHeight, faceBoxRef.current);
    canvas.width = crop.sw;
    canvas.height = crop.sh;
    ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, crop.sw, crop.sh);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    stopCamera();
    try {
      await processSelectedPhoto(dataUrl);
    } finally {
      setAutoCapturing(false);
      autoCapturingRef.current = false;
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
      stopCamera();
      await processSelectedPhoto(croppedDataUrl);
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

  function resetForNext() {
    setCapturedDataUrl("");
    setPhotoAnalysis(null);
    setDraft({
      fullName: "",
      parentName: "",
      mobile: sessionContext?.session.verifiedMobile || verifiedMobile,
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
            <motion.div
              className="h-2 rounded-full bg-[linear-gradient(90deg,#0F3C78,#1C6ED5)]"
              animate={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {status ? <p className="text-xs text-emerald-300">{status}</p> : null}
        {error ? <p className="text-xs text-rose-300">{error}</p> : null}

        {step === "auth" ? (
          <section className="glass rounded-2xl p-4">
            <p className="mb-1 text-sm font-semibold">Step 1: Mobile authentication</p>
            <p className="mb-3 text-xs text-[var(--text-muted)]">
              {publicMeta?.campaign?.message || getActorMessage(actorType)}
            </p>
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <input
                value={mobile}
                onChange={(event) => setMobile(event.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder={getMobilePlaceholder(actorType)}
                inputMode="numeric"
                autoComplete="tel"
                className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
              />
              <button
                onClick={sendOtp}
                disabled={sendingOtp}
                className="rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {sendingOtp ? "Sending..." : "Send OTP"}
              </button>
            </div>
          </section>
        ) : null}

        {step === "otp" ? (
          <section className="glass rounded-2xl p-4">
            <p className="mb-1 text-sm font-semibold">Step 2: Verify OTP</p>
            <p className="mb-3 text-xs text-[var(--text-muted)]">
              Enter the 6-digit OTP sent to {maskMobile(mobile)}.
            </p>
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <input
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit OTP"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none"
              />
              <button
                onClick={verifyOtp}
                disabled={verifyingOtp}
                className="rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {verifyingOtp ? "Verifying..." : "Verify OTP"}
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>OTP is required before the form can open.</span>
              <button
                type="button"
                onClick={() => void sendOtp()}
                disabled={sendingOtp || resendAt > now}
                className="rounded-lg border border-[var(--line-soft)] px-3 py-1 disabled:opacity-50"
              >
                {resendAt > now ? `Resend in ${Math.ceil((resendAt - now) / 1000)}s` : "Resend OTP"}
              </button>
            </div>
          </section>
        ) : null}

        {loadingSession ? (
          <section className="glass rounded-2xl p-4">
            <p className="text-sm text-[var(--text-muted)]">Loading verified intake session...</p>
          </section>
        ) : null}

        {step === "details" && sessionContext ? (
          <section className="glass rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="m-0 text-sm font-semibold">Step 3: Intake form</p>
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
                    placeholder="Verified mobile number"
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
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Step 4: Photo upload or capture</p>
              <span className="text-[11px] text-[var(--text-muted)]">
                Background: {photoBackgroundPreference}
              </span>
            </div>
            <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
              <div>
                <div className="relative">
                  <video
                    ref={videoRef}
                    className="h-[420px] w-full rounded-2xl border border-[var(--line-soft)] bg-black object-cover"
                    playsInline
                    muted
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="relative h-[72%] w-[52%] rounded-[2rem] border-2 border-[rgba(255,255,255,0.92)] shadow-[0_0_0_9999px_rgba(4,10,22,0.24)]">
                      <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-[rgba(4,10,22,0.78)] px-3 py-1 text-[11px] font-medium text-white">
                        Keep face inside the center frame
                      </div>
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-[rgba(4,10,22,0.78)] px-3 py-1 text-[10px] text-white">
                        Eyes level, face straight, shoulders visible
                      </div>
                    </div>
                  </div>
                </div>
                <canvas ref={captureCanvasRef} className="hidden" />
              </div>
              <div className="space-y-2">
                <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-soft)] p-3 text-xs text-[var(--text-muted)]">
                  <p className="m-0 font-medium text-[var(--text-primary)]">AI guidance</p>
                  <p className="m-0 mt-1">{guidance}</p>
                  <p className="m-0 mt-2 text-[11px] text-[var(--text-muted)]">
                    Parents on mobile should keep the face steady in the middle. Auto capture locks only after face, center, light, and background checks all pass together.
                  </p>
                  <div className="mt-2 rounded-lg border border-[var(--line-soft)] px-2 py-2 text-[11px]">
                    <p className="m-0 text-[var(--text-primary)]">
                      Readiness hold: <span className="font-medium">{captureStability}/{CAPTURE_STABILITY_TARGET}</span>
                    </p>
                    <p className="m-0 mt-1 text-[var(--text-muted)]">
                      Hold still very briefly while the frame locks in.
                    </p>
                  </div>
                  <div className="mt-3 space-y-2">
                    <GuidanceRow
                      label="Face position"
                      ready={captureAssistant.faceDetected && captureAssistant.faceCentered}
                      note={
                        captureAssistant.guidanceMode === "native"
                          ? "Keep the face in the middle."
                          : captureAssistant.guidanceMode === "fallback"
                            ? "Fallback face guidance active. Keep the face inside the center frame."
                            : "Manual alignment mode."
                      }
                    />
                    <GuidanceRow
                      label="Lighting"
                      ready={captureAssistant.lightingGood}
                      note="Use even light on the face."
                    />
                    <GuidanceRow
                      label="Background"
                      ready={captureAssistant.backgroundGood}
                      note={
                        photoBackgroundPreference === "NONE"
                          ? "Background not enforced."
                          : photoBackgroundPreference === "PLAIN"
                            ? "Any plain, uncluttered background is preferred."
                          : `Plain ${photoBackgroundPreference.toLowerCase()} background preferred.`
                      }
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-soft)] p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <p className="m-0 font-medium text-[var(--text-primary)]">Auto capture</p>
                    <button
                      type="button"
                      onClick={() => {
                        if (autoCaptureEnabled) {
                          clearAutoCaptureTimer();
                          setAutoCapturing(false);
                        }
                        setAutoCaptureEnabled((prev) => !prev);
                      }}
                      className={`rounded-full border px-3 py-1 text-[11px] ${
                        autoCaptureEnabled
                          ? "border-[#1C6ED5] bg-[rgba(28,110,213,0.16)] text-white"
                          : "border-[var(--line-soft)] text-[var(--text-muted)]"
                      }`}
                    >
                      {autoCaptureEnabled ? "ON" : "OFF"}
                    </button>
                  </div>
                  <p className="m-0 mt-2 text-[var(--text-muted)]">
                    {captureAssistant.guidanceMode === "manual"
                      ? "Auto capture is not available in this browser. Manual capture is available."
                      : "As soon as the frame is clean and stable, capture happens automatically."}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-soft)] p-3 text-xs">
                  <p className="m-0 mb-2 flex items-center gap-2">
                    <Smartphone size={13} /> Camera source
                  </p>
                  <select
                    value={deviceId}
                    onChange={(event) => setDeviceId(event.target.value)}
                    className="w-full rounded-xl border border-[var(--line-soft)] bg-transparent px-2 py-2 text-xs outline-none"
                  >
                    {devices.map((device, index) => (
                      <option key={device.deviceId || index} value={device.deviceId}>
                        {device.label || `Camera ${index + 1}`}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      void startCamera();
                    }}
                    className="mt-2 w-full rounded-xl border border-[var(--line-soft)] px-3 py-2 text-xs"
                  >
                    Switch / restart camera
                  </button>
                </div>
                {capturedDataUrl ? (
                  <div className="overflow-hidden rounded-xl border border-[var(--line-soft)] bg-[var(--surface-soft)]">
                    <img src={capturedDataUrl} alt="Latest capture" className="h-40 w-full object-cover" />
                    {photoAnalysis ? (
                      <div className="border-t border-[var(--line-soft)] px-3 py-2 text-[11px] text-[var(--text-muted)]">
                        <p className="m-0">
                          Last analysis: <span className="font-medium text-[var(--text-primary)]">{photoAnalysis.quality.status}</span>
                        </p>
                        {photoAnalysis.quality.warnings.length ? (
                          <p className="m-0 mt-1 text-rose-300">{photoAnalysis.quality.warnings[0]}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <button
                  onClick={() => void capturePhoto("manual")}
                  disabled={(captureAssistant.guidanceMode !== "manual" && !captureAssistant.ready) || autoCapturing}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  <Camera size={15} /> {autoCapturing ? "Auto capturing..." : "Capture"}
                </button>
                {sessionContext.submissionModel.allowPhotoUpload ? (
                  <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--line-soft)] px-4 py-2 text-sm">
                    <Upload size={15} /> Upload photo
                    <input type="file" accept="image/png,image/jpeg" onChange={(event) => void handlePhotoUpload(event)} className="hidden" />
                  </label>
                ) : null}
                <button
                  onClick={() => {
                    stopCamera();
                    setStep("details");
                  }}
                  className="w-full rounded-xl border border-[var(--line-soft)] px-3 py-2 text-xs"
                >
                  Back
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {step === "review" && sessionContext ? (
          <section className="glass rounded-2xl p-4">
            <p className="mb-2 text-sm font-semibold">Step 5: Preview and submit</p>
            <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
              <div className="rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-soft)] p-3">
                <img src={capturedDataUrl} alt="Captured" className="h-[420px] w-full rounded-xl object-cover" />
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-soft)] p-4">
                  <p className="m-0 text-sm font-semibold">Submission summary</p>
                  <div className="mt-3 space-y-1 text-xs text-[var(--text-muted)]">
                    <p className="m-0">Institution: {sessionContext.link.school.name}</p>
                    <p className="m-0">Campaign: {sessionContext.link.campaignName}</p>
                    {segmentLabel ? <p className="m-0">Segment: {segmentLabel}</p> : null}
                    <p className="m-0">{actorType === "PARENT" ? "Student" : "Name"}: {draft.fullName}</p>
                    {showParentName ? <p className="m-0">Parent: {draft.parentName}</p> : null}
                    {showClassName ? <p className="m-0">{primaryLabel}: {fixedPrimaryValue || draft.className || "--"}</p> : null}
                    {showDivision ? <p className="m-0">{secondaryLabel}: {fixedSecondaryValue || draft.division || "--"}</p> : null}
                    {showRollNumber ? <p className="m-0">Roll Number: {draft.rollNumber || "--"}</p> : null}
                    {showMobile ? <p className="m-0">Verified Mobile: {draft.mobile || verifiedMobile}</p> : null}
                    {showEmergencyNumber ? <p className="m-0">Emergency Number: {draft.emergencyNumber || "--"}</p> : null}
                    {showAddress ? <p className="m-0">Address: {draft.address || "--"}</p> : null}
                    {showAadhaarNumber ? <p className="m-0">Aadhaar Number: {draft.aadhaarNumber || "--"}</p> : null}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-soft)] p-3 text-xs">
                  <p className="m-0 text-sm font-semibold">Photo quality</p>
                  {enhancingPhoto ? (
                    <p className="m-0 mt-2 text-[var(--text-muted)]">
                      Applying print-ready enhancement: plain background cleanup, light balancing, and mild sharpening...
                    </p>
                  ) : null}
                  {analyzingPhoto ? <p className="m-0 mt-2 text-[var(--text-muted)]">Analyzing face, light, and clarity...</p> : null}
                  {photoAnalysis ? (
                    <div className="mt-2 space-y-1">
                      <p className="m-0">
                        Status: <span className="font-semibold">{photoAnalysis.quality.status}</span>
                      </p>
                      <p className="m-0">Score: {photoAnalysis.quality.score ?? "--"}</p>
                      {photoAnalysis.quality.warnings.length ? (
                        <ul className="m-0 list-disc pl-4 text-rose-300">
                          {photoAnalysis.quality.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="m-0 text-emerald-300">Photo passed quality checks.</p>
                      )}
                    </div>
                  ) : null}
                  <p className="m-0 mt-2 text-[var(--text-muted)]">
                    Photo file name will be stored using the entered full name, and the saved image uses the print-ready enhanced version.
                  </p>
                  {submissionModel.workflowRequired ? (
                    <p className="m-0 mt-2 text-[var(--text-muted)]">
                      Final submit will save the record and place it into review.
                    </p>
                  ) : null}
                </div>
                <button
                  onClick={() => void submitIntake()}
                  disabled={enhancingPhoto || submitting || !capturedDataUrl}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-4 py-2 text-sm font-semibold disabled:opacity-60"
                >
                  <ShieldCheck size={15} />{" "}
                  {submitting
                    ? "Saving submission..."
                    : analyzingPhoto
                      ? "Final submit while checks finish"
                      : "Final submit"}
                </button>
                <button
                  onClick={() => {
                    setError("");
                    setStatus("");
                    setStep("photo");
                    void startCamera();
                  }}
                  className="w-full rounded-xl border border-[var(--line-soft)] px-3 py-2 text-xs"
                >
                  Retake photo
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {step === "done" ? (
          <section className="glass rounded-2xl p-4 text-center">
            <CheckCircle2 className="mx-auto mb-3" size={36} />
            <p className="text-lg font-semibold">Submission complete</p>
            <p className="text-xs text-[var(--text-muted)]">
              The intake record has been saved against the verified mobile number.
            </p>
            <button
              onClick={resetForNext}
              className="mt-3 rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-4 py-2 text-sm font-semibold"
            >
              Add another record
            </button>
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
