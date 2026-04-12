"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Link2,
  RefreshCcw,
  Search,
  ShieldCheck,
  X,
  User,
  AlertTriangle
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type RoleKey =
  | "SUPER_ADMIN"
  | "COMPANY_ADMIN"
  | "SALES_PERSON"
  | "OPERATIONS_ADMIN"
  | "HR_ADMIN"
  | "SALES"
  | "PRINTING"
  | "PRINT_OPS"
  | "HR"
  | "FINANCE"
  | "SUPPORT"
  | "SCHOOL_ADMIN"
  | "SCHOOL_STAFF"
  | "PARENT";

type SchoolStatus = "ACTIVE" | "INACTIVE";
type InstitutionType = "SCHOOL" | "COLLEGE" | "COMPANY" | "COACHING_INSTITUTE";
type IntakeAudience = "PARENT" | "STUDENT" | "EMPLOYEE";
type StudentStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "SCHOOL_APPROVED"
  | "SALES_APPROVED"
  | "IN_PRINT_QUEUE"
  | "PRINTED"
  | "DELIVERED"
  | "REJECTED";

type TabKey = "overview" | "students" | "campaigns" | "invoices" | "audit";

type SchoolDetailStudent = {
  id: string;
  fullName: string;
  className?: string | null;
  section?: string | null;
  rollNumber?: string | null;
  parentName?: string | null;
  parentMobile?: string | null;
  photoKey?: string | null;
  photoLink?: string | null;
  status: StudentStatus;
  duplicateFlag?: boolean | null;
  createdAt: string;
};

type SchoolDetailResponse = {
  school: {
    id: string;
    name: string;
    code: string;
    email: string;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    principalName?: string | null;
    principalEmail?: string | null;
    principalPhone?: string | null;
    status?: SchoolStatus;
    salesOwnerId?: string | null;
    institutionType?: InstitutionType;
    createdAt: string;
  };
  stats: {
    totalStudents: number;
    submitted: number;
    approved: number;
    inPrint: number;
    printed: number;
    delivered: number;
    rejected: number;
    intakeLinks: number;
    parents: number;
    invoices: number;
    invoiceTotal: number;
  };
  recentStudents: SchoolDetailStudent[];
  staff: Array<{
    id: string;
    name?: string | null;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: string;
  }>;
};

type SchoolStudentListResponse = {
  page: number;
  pageSize: number;
  total: number;
  rows: SchoolDetailStudent[];
};

type StudentExportResponse = {
  fileName: string;
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, string | number | null>>;
};

type ClassSummaryRow = {
  className: string;
  section: string;
  total: number;
  submitted: number;
  schoolApproved: number;
  salesApproved: number;
  inPrintQueue: number;
  printed: number;
  delivered: number;
  rejected: number;
};

type CampaignLinkRow = {
  id: string;
  token: string;
  className: string;
  section: string;
  segmentKey: string;
  segmentLabel: string;
  primaryLabel: string;
  primaryValue: string;
  secondaryLabel?: string | null;
  secondaryValue?: string | null;
  expectedVolume: number;
  maxStudentsPerParent: number;
  photoBgPreference: string;
  expiresAt: string;
  createdAt: string;
  isActive: boolean;
  submitted: number;
  approved: number;
  rejected: number;
  pending: number;
};

type CampaignSegmentRow = {
  segmentKey: string;
  label: string;
  primaryLabel: string;
  primaryValue: string;
  secondaryLabel?: string | null;
  secondaryValue?: string | null;
  expectedVolume: number;
  submitted: number;
  approved: number;
  rejected: number;
  pending: number;
  links: CampaignLinkRow[];
};

type IntakeCampaignRow = {
  id: string;
  schoolId: string;
  name: string;
  institutionType: InstitutionType;
  audience: IntakeAudience;
  className?: string;
  section?: string;
  photoBgPreference?: string;
  maxExpectedVolume: number;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
  dataSchema: Record<string, boolean>;
  submissionModel: {
    mode?: string;
    requirePhotoStandardization?: boolean;
    requireParentOtp?: boolean;
    distributionChannels?: string[];
    bulkUploadEnabled?: boolean;
    intakeLinkOptional?: boolean;
    workflowRequired?: boolean;
  };
  approvalRules: {
    approvalRequired?: boolean;
  };
  metadata: Record<string, string | boolean | number | null>;
  targetSegments: CampaignSegmentRow[];
  links: CampaignLinkRow[];
  totals: {
    generatedLinks: number;
    expected: number;
    submitted: number;
    approved: number;
    rejected: number;
    pending: number;
  };
};

type InvoiceRow = {
  id: string;
  invoiceNo: string;
  status: string;
  totalAmount: number;
  amountPaid: number;
  issuedAt: string;
  dueAt?: string | null;
  school?: { id: string; name: string; code: string } | null;
};

type BillingReconciliation = {
  serverTime: string;
  totals: {
    invoiced: number;
    collected: number;
    outstanding: number;
    overdue: number;
    overdueCount: number;
    invoiceCount: number;
  };
  byStatus: Array<{
    status: string;
    count: number;
    total: number;
    paid: number;
    outstanding: number;
  }>;
  aging: Array<{ bucket: string; count: number; amount: number }>;
  topSchools: Array<{
    schoolId: string;
    schoolName: string;
    schoolCode: string;
    total: number;
    paid: number;
    outstanding: number;
  }>;
};

type AuditRow = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  createdAt: string;
  actorUser?: { id: string; email: string; role: string } | null;
};

type CampaignForm = {
  campaignName: string;
  institutionType: InstitutionType;
  maxExpectedVolume: string;
  startsAt: string;
  expiresAt: string;
  dataSchema: {
    fullName: boolean;
    photo: boolean;
    className: boolean;
    division: boolean;
    rollNumber: boolean;
    dob: boolean;
    bloodGroup: boolean;
    parentName: boolean;
    mobileNumber: boolean;
    emergencyNumber: boolean;
    fullAddress: boolean;
    aadhaarNumber: boolean;
  };
  submissionModel: {
    mode: string;
    actorType: "PARENT" | "STUDENT" | "STAFF";
    requirePhotoStandardization: boolean;
    requireParentOtp: boolean;
    distributionChannels: string[];
    bulkUploadEnabled: boolean;
    intakeLinkOptional: boolean;
    workflowRequired: boolean;
    allowMobileEditAfterVerification: boolean;
    duplicatePolicy: "ONE_PER_CAMPAIGN" | "ONE_PER_STUDENT" | "ALLOW_MULTIPLE";
  };
  approvalRequired: boolean;
  maxStudentsPerParent: string;
  photoBgPreference: string;
};

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "students", label: "Students" },
  { key: "campaigns", label: "Intake Campaigns" },
  { key: "invoices", label: "Invoices" },
  { key: "audit", label: "Audit" }
];

const WORKFLOW_STATUSES: StudentStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "SCHOOL_APPROVED",
  "SALES_APPROVED",
  "IN_PRINT_QUEUE",
  "PRINTED",
  "DELIVERED",
  "REJECTED"
];

const DATA_SCHEMA_FIELDS: Array<{
  key: keyof CampaignForm["dataSchema"];
  label: string;
  locked?: boolean;
}> = [
  { key: "fullName", label: "Full Name", locked: true },
  { key: "className", label: "Class / Department" },
  { key: "division", label: "Division / Year" },
  { key: "rollNumber", label: "Roll Number" },
  { key: "dob", label: "DOB" },
  { key: "bloodGroup", label: "Blood Group" },
  { key: "parentName", label: "Parent Name" },
  { key: "mobileNumber", label: "Mobile Number" },
  { key: "emergencyNumber", label: "Emergency Number" },
  { key: "fullAddress", label: "Full Address" },
  { key: "aadhaarNumber", label: "Aadhaar Number" }
];

export default function SchoolDrillPage() {
  const router = useRouter();
  const params = useParams<{ schoolId: string }>();
  const schoolId = useMemo(() => {
    const raw = params?.schoolId;
    return Array.isArray(raw) ? raw[0] : raw || "";
  }, [params]);
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api/v2";
  const apiOrigin = useMemo(() => {
    try {
      return new URL(apiBase).origin;
    } catch {
      return typeof window !== "undefined" ? window.location.origin : "http://localhost:4000";
    }
  }, [apiBase]);

  const [booting, setBooting] = useState(true);
  const [role, setRole] = useState<RoleKey>("SUPER_ADMIN");
  const [tab, setTab] = useState<TabKey>("overview");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [detail, setDetail] = useState<SchoolDetailResponse | null>(null);
  const [detailDraft, setDetailDraft] = useState<{
    name: string;
    email: string;
    phone: string;
    city: string;
    state: string;
    status: SchoolStatus;
  } | null>(null);

  const [students, setStudents] = useState<SchoolStudentListResponse | null>(null);
  const [classSummary, setClassSummary] = useState<ClassSummaryRow[]>([]);
  const [classFilter, setClassFilter] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [studentStatus, setStudentStatus] = useState<StudentStatus | "">("");
  const [studentsPage, setStudentsPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState<SchoolDetailStudent | null>(null);

  const [campaigns, setCampaigns] = useState<IntakeCampaignRow[]>([]);
  const [campaignForm, setCampaignForm] = useState<CampaignForm>(() => buildCampaignForm("SCHOOL"));
  const [campaignStep, setCampaignStep] = useState<1 | 2>(1);

  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [recon, setRecon] = useState<BillingReconciliation | null>(null);
  const [billingRange, setBillingRange] = useState(defaultMonthRange());

  const [audits, setAudits] = useState<{ page: number; pageSize: number; total: number; rows: AuditRow[] } | null>(
    null
  );
  const [auditEntityType, setAuditEntityType] = useState("");
  const [auditPage, setAuditPage] = useState(1);

  const [loading, setLoading] = useState({
    detail: true,
    saveSchool: false,
    students: false,
    studentExport: false,
    classSummary: false,
    studentUpdate: "",
    campaigns: false,
    campaignCreate: false,
    invoices: false,
    recon: false,
    audits: false
  });

  const publicOrigin = useMemo(
    () => (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"),
    []
  );
  const validCampaigns = useMemo(
    () =>
      campaigns.filter((campaign) =>
        campaign.targetSegments.some(
          (segment) =>
            !!segment.primaryValue?.trim() &&
            !["na", "n/a"].includes(segment.primaryValue.trim().toLowerCase()) &&
            !!segment.label?.trim() &&
            !segment.label.toLowerCase().includes("pending")
        )
      ),
    [campaigns]
  );

  useEffect(() => {
    const r = (localStorage.getItem("company_role") || "SUPER_ADMIN") as RoleKey;
    setRole(r);
    const t = window.setTimeout(() => setBooting(false), 380);
    return () => window.clearTimeout(t);
  }, [router]);

  useEffect(() => {
    if (!schoolId || booting) return;
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, booting]);

  useEffect(() => {
    if (!schoolId || booting) return;
    if (tab === "students") void loadStudents(studentsPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentsPage, studentStatus, classFilter, tab]);

  useEffect(() => {
    setStudentsPage(1);
  }, [studentStatus, classFilter]);

  useEffect(() => {
    if (!schoolId || booting) return;
    if (tab === "audit") void loadAudits(auditPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditPage, auditEntityType, tab]);

  useEffect(() => {
    if (!schoolId || booting) return;
    if (tab === "invoices") void loadReconciliation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billingRange.start, billingRange.end, tab]);

  async function apiRequest<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
    const accessToken = localStorage.getItem("company_access_token");
    const refreshToken = localStorage.getItem("company_refresh_token");
    const headers: Record<string, string> = { ...((options.headers || {}) as Record<string, string>) };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    if (!headers["Content-Type"] && options.body) headers["Content-Type"] = "application/json";

    const res = await fetch(`${apiBase}${path}`, { ...options, headers, credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && retry) {
      const refresh = await fetch(`${apiBase}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(refreshToken ? { refreshToken } : {})
      });
      if (refresh.ok) {
        return apiRequest<T>(path, options, false);
      }
    }
    if (res.status === 401) {
      localStorage.removeItem("company_access_token");
      localStorage.removeItem("company_refresh_token");
      localStorage.removeItem("company_role");
      localStorage.removeItem("company_user");
      router.replace("/login");
      throw new Error("Session expired");
    }
    if (!res.ok) throw new Error(data.message || data.error || `Request failed ${res.status}`);
    return data as T;
  }

  function buildStudentPhotoFileName(fullName?: string | null, photoKey?: string | null) {
    const cleanedName = (fullName || "")
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1f]+/g, " ")
      .replace(/\s+/g, " ");
    const fileName = photoKey?.trim().split("/").pop() || "";
    const extensionMatch = fileName.match(/(\.[a-z0-9]+)$/i);
    const extension = extensionMatch?.[1] || ".jpg";
    return `${cleanedName || "student-photo"}${extension}`;
  }

  function normalizeSignedAssetUrl(rawUrl?: string | null) {
    const value = (rawUrl || "").trim();
    if (!value) return "";
    try {
      const parsed =
        value.startsWith("http://") || value.startsWith("https://") ? new URL(value) : new URL(value, apiOrigin);
      if (!["localhost", "127.0.0.1", "0.0.0.0"].includes(parsed.hostname)) {
        return parsed.toString();
      }
      return new URL(`${parsed.pathname}${parsed.search}${parsed.hash}`, apiOrigin).toString();
    } catch {
      return value;
    }
  }

  async function getSignedPhotoLinkMap(photoKeys: Array<string | null | undefined>) {
    const uniquePhotoKeys = Array.from(
      new Set(
        photoKeys
          .map((photoKey) => (typeof photoKey === "string" ? photoKey.trim() : ""))
          .filter(Boolean)
      )
    );

    const signedPhotoLinks = new Map<string, string>();
    await Promise.allSettled(
      uniquePhotoKeys.map(async (photoKey) => {
        const signed = await apiRequest<{ signedUrl: string }>(
          `/platform/security/assets/signed-url?photoKey=${encodeURIComponent(photoKey)}&ttlSeconds=86400`
        );
        signedPhotoLinks.set(photoKey, normalizeSignedAssetUrl(signed.signedUrl));
      })
    );

    return signedPhotoLinks;
  }

  async function loadAll() {
    setLoading((p) => ({ ...p, detail: true }));
    setError("");
    try {
      await Promise.all([
        loadDetail(),
        loadClassSummary(),
        loadStudents(1),
        loadCampaigns(),
        loadInvoices(),
        loadReconciliation(),
        loadAudits(1)
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load school drill page");
      clearFlash();
    } finally {
      setLoading((p) => ({ ...p, detail: false }));
    }
  }

  async function loadDetail() {
    const res = await apiRequest<SchoolDetailResponse>(`/admin/schools/${encodeURIComponent(schoolId)}/detail`);
    setDetail(res);
    setDetailDraft({
      name: res.school.name,
      email: res.school.email,
      phone: res.school.phone || "",
      city: res.school.city || "",
      state: res.school.state || "",
      status: res.school.status || "ACTIVE"
    });
    setCampaignForm((prev) =>
      !prev.campaignName
        ? buildCampaignForm((res.school.institutionType || "SCHOOL") as InstitutionType, res.school.name)
        : prev
    );
  }

  async function saveSchool() {
    if (!detailDraft) return;
    setLoading((p) => ({ ...p, saveSchool: true }));
    try {
      await apiRequest(`/admin/schools/${encodeURIComponent(schoolId)}`, {
        method: "PATCH",
        body: JSON.stringify(detailDraft)
      });
      setSuccess("School updated and audited.");
      await loadDetail();
      await loadAudits(1);
      clearFlash();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update school");
      clearFlash();
    } finally {
      setLoading((p) => ({ ...p, saveSchool: false }));
    }
  }

  async function loadStudents(page = 1) {
    setLoading((p) => ({ ...p, students: true }));
    try {
      const q = new URLSearchParams();
      q.set("page", String(page));
      q.set("pageSize", "20");
      if (studentQuery.trim()) q.set("q", studentQuery.trim());
      if (studentStatus) q.set("status", studentStatus);
      if (classFilter) q.set("className", classFilter);
      const res = await apiRequest<SchoolStudentListResponse>(
        `/admin/schools/${encodeURIComponent(schoolId)}/students?${q.toString()}`
      );
      const signedPhotoLinks = await getSignedPhotoLinkMap(res.rows.map((row) => row.photoKey));
      setStudents({
        ...res,
        rows: res.rows.map((row) => {
          const photoKey = typeof row.photoKey === "string" ? row.photoKey.trim() : "";
          return {
            ...row,
            photoLink: photoKey ? signedPhotoLinks.get(photoKey) || "" : ""
          };
        })
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load students");
      clearFlash();
    } finally {
      setLoading((p) => ({ ...p, students: false }));
    }
  }

  async function loadClassSummary() {
    setLoading((p) => ({ ...p, classSummary: true }));
    try {
      const res = await apiRequest<{ rows: ClassSummaryRow[] }>(
        `/admin/schools/${encodeURIComponent(schoolId)}/classes`
      );
      setClassSummary(res.rows || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load class summary");
      clearFlash();
    } finally {
      setLoading((p) => ({ ...p, classSummary: false }));
    }
  }

  async function updateStudent(studentId: string, status: StudentStatus) {
    setLoading((p) => ({ ...p, studentUpdate: studentId }));
    try {
      await apiRequest(`/admin/students/${encodeURIComponent(studentId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      setStudents((prev) =>
        prev
          ? { ...prev, rows: prev.rows.map((r) => (r.id === studentId ? { ...r, status } : r)) }
          : prev
      );
      setSuccess("Student status updated.");
      await loadClassSummary();
      await loadAudits(1);
      clearFlash();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update student");
      clearFlash();
    } finally {
      setLoading((p) => ({ ...p, studentUpdate: "" }));
    }
  }

  async function loadCampaigns() {
    setLoading((p) => ({ ...p, campaigns: true }));
    try {
      const rows = await apiRequest<IntakeCampaignRow[]>(`/campaigns?schoolId=${encodeURIComponent(schoolId)}`);
      setCampaigns(
        rows.map((campaign) => ({
          ...campaign,
          className: campaign.name,
          section: formatInstitutionLabel(campaign.institutionType),
          photoBgPreference: formatAudienceLabel(campaign.audience),
          targetSegments: campaign.targetSegments.filter(
            (segment) =>
              !!segment.primaryValue?.trim() &&
              !["na", "n/a"].includes(segment.primaryValue.trim().toLowerCase()) &&
              !!segment.label?.trim() &&
              !segment.label.toLowerCase().includes("pending")
          )
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load intake campaigns");
      clearFlash();
    } finally {
      setLoading((p) => ({ ...p, campaigns: false }));
    }
  }

  async function createCampaign() {
    if (!campaignForm.campaignName.trim()) {
      setError("Campaign name is required.");
      clearFlash();
      return;
    }
    if (!campaignForm.startsAt || !campaignForm.expiresAt) {
      setError("Start and expiry dates are required.");
      clearFlash();
      return;
    }

    const expectedVolume = Number(campaignForm.maxExpectedVolume || "0") || 0;
    setLoading((p) => ({ ...p, campaignCreate: true }));
    try {
      await apiRequest(`/schools/${encodeURIComponent(schoolId)}/campaigns`, {
        method: "POST",
        body: JSON.stringify({
          campaignName: campaignForm.campaignName.trim(),
          institutionType: campaignForm.institutionType,
          targetSegments: [
            {
              primaryValue: "ALL",
              secondaryValue: "ALL",
              expectedVolume
            }
          ],
          maxExpectedVolume: expectedVolume || undefined,
          startsAt: campaignForm.startsAt || undefined,
          expiresAt: campaignForm.expiresAt || undefined,
          dataSchema: {
            ...campaignForm.dataSchema,
            fullName: true,
            photo: true
          },
          submissionModel: campaignForm.submissionModel,
          approvalRules: {
            approvalRequired: campaignForm.approvalRequired
          },
          maxStudentsPerParent: Number(campaignForm.maxStudentsPerParent || "3"),
          photoBgPreference: campaignForm.photoBgPreference
        })
      });
      setSuccess("Campaign created and child intake links generated.");
      setCampaignForm(buildCampaignForm(campaignForm.institutionType, detail?.school.name || ""));
      setCampaignStep(1);
      await Promise.all([loadCampaigns(), loadDetail(), loadAudits(1)]);
      clearFlash();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create intake campaign");
      clearFlash();
    } finally {
      setLoading((p) => ({ ...p, campaignCreate: false }));
    }
  }

  function updateCampaignInstitution(institutionType: InstitutionType) {
    setCampaignForm((prev) => {
      const next = buildCampaignForm(institutionType, detail?.school.name || "");
      return {
        ...next,
        campaignName: prev.campaignName || next.campaignName,
        startsAt: prev.startsAt || next.startsAt,
        expiresAt: prev.expiresAt || next.expiresAt
      };
    });
    setCampaignStep(1);
  }

  function advanceCampaignStep() {
    if (campaignStep === 1) {
      if (!campaignForm.campaignName.trim()) {
        setError("Campaign name is required.");
        clearFlash();
        return;
      }
      if (!campaignForm.startsAt || !campaignForm.expiresAt) {
        setError("Start and expiry dates are required.");
        clearFlash();
        return;
      }
      setCampaignStep(2);
    }
  }

  function toggleSchemaField(field: keyof CampaignForm["dataSchema"]) {
    if (field === "fullName") return;
    setCampaignForm((prev) => ({
      ...prev,
      dataSchema: {
        ...prev.dataSchema,
        [field]: !prev.dataSchema[field]
      }
    }));
  }

  async function loadInvoices() {
    setLoading((p) => ({ ...p, invoices: true }));
    try {
      setInvoices(await apiRequest<InvoiceRow[]>(`/billing/invoices?schoolId=${encodeURIComponent(schoolId)}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load invoices");
      clearFlash();
    } finally {
      setLoading((p) => ({ ...p, invoices: false }));
    }
  }

  async function loadReconciliation() {
    setLoading((p) => ({ ...p, recon: true }));
    try {
      const q = new URLSearchParams();
      q.set("schoolId", schoolId);
      q.set("start", billingRange.start);
      q.set("end", billingRange.end);
      setRecon(await apiRequest<BillingReconciliation>(`/billing/reconciliation?${q.toString()}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load billing reconciliation");
      clearFlash();
    } finally {
      setLoading((p) => ({ ...p, recon: false }));
    }
  }

  async function loadAudits(page = 1) {
    setLoading((p) => ({ ...p, audits: true }));
    try {
      const q = new URLSearchParams();
      q.set("page", String(page));
      q.set("pageSize", "20");
      if (auditEntityType.trim()) q.set("entityType", auditEntityType.trim());
      const res = await apiRequest<{ page: number; pageSize: number; total: number; rows: AuditRow[] }>(
        `/admin/schools/${encodeURIComponent(schoolId)}/audit-logs?${q.toString()}`
      );
      setAudits(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit logs");
      clearFlash();
    } finally {
      setLoading((p) => ({ ...p, audits: false }));
    }
  }

  function clearFlash() {
    window.setTimeout(() => {
      setError("");
      setSuccess("");
    }, 2400);
  }

  function copyToClipboard(value: string) {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(value);
      setSuccess("Copied.");
      clearFlash();
      return;
    }
    const ta = document.createElement("textarea");
    ta.value = value;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    setSuccess("Copied.");
    clearFlash();
  }

  function exportCsv(name: string, headers: string[], rows: Array<Array<string | number>>) {
    const csv = [headers, ...rows]
      .map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportStudentsCsv() {
    setLoading((prev) => ({ ...prev, studentExport: true }));
    try {
      const query = new URLSearchParams();
      if (studentQuery.trim()) query.set("q", studentQuery.trim());
      if (studentStatus) query.set("status", studentStatus);
      if (classFilter.trim()) query.set("className", classFilter.trim());

      const exportData = await apiRequest<StudentExportResponse>(
        `/admin/schools/${encodeURIComponent(schoolId)}/students/export${query.toString() ? `?${query.toString()}` : ""}`
      );

      const signedPhotoLinks = await getSignedPhotoLinkMap(exportData.rows.map((row) => String(row.photoKey ?? "")));

      const rows: Array<Record<string, string | number | null>> = exportData.rows.map((row) => {
        const photoKey = typeof row.photoKey === "string" ? row.photoKey.trim() : "";
        const fullName = typeof row.fullName === "string" ? row.fullName.trim() : "";
        return {
          ...row,
          photoFileName: photoKey
            ? buildStudentPhotoFileName(fullName, photoKey)
            : String(row.photoFileName ?? ""),
          photoLink: photoKey ? signedPhotoLinks.get(photoKey) || "" : ""
        };
      });

      const columns = [...exportData.columns];
      if (!columns.some((column) => column.key === "photoFileName")) {
        columns.push({ key: "photoFileName", label: "Photo File Name" });
      }
      if (!columns.some((column) => column.key === "photoLink")) {
        columns.push({ key: "photoLink", label: "Photo Link" });
      }

      exportCsv(
        exportData.fileName,
        columns.map((column) => column.label),
        rows.map((row) =>
          columns.map((column) => {
            const value = row[column.key];
            return typeof value === "number" ? value : String(value ?? "");
          })
        )
      );
      setSuccess("Student export ready.");
      clearFlash();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to export students");
      clearFlash();
    } finally {
      setLoading((prev) => ({ ...prev, studentExport: false }));
    }
  }

  if (booting || loading.detail) {
    return <SchoolLoader />;
  }

  if (!detail) {
    return (
      <main className="min-h-screen px-6 py-8 text-[var(--text-primary)]">
        <div className="mx-auto max-w-4xl">
          <div className="glass p-5">
            <p className="m-0 text-lg font-semibold">School not found or inaccessible.</p>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="mt-3 rounded-xl border border-[var(--line-soft)] px-4 py-2 text-xs"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-3 py-3 text-[var(--text-primary)] md:px-6 md:py-6">
      <div className="mx-auto max-w-[1680px] space-y-3">
        <header className="glass sticky top-3 z-20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--line-soft)] px-2 py-1 text-xs hover-glow"
              >
                <ArrowLeft size={13} /> Back
              </button>
              <p className="m-0 text-2xl font-semibold">{detail.school.name}</p>
              <p className="m-0 text-xs text-[var(--text-muted)]">
                {detail.school.code} • {detail.school.email} • Role: {role}
              </p>
            </div>
            <div className="text-right text-xs text-[var(--text-muted)]">
              <p className="m-0">Created: {formatDate(detail.school.createdAt)}</p>
              <p className="m-0 mt-1">Status: {detail.school.status || "ACTIVE"}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`rounded-xl border px-3 py-1.5 text-xs ${
                  tab === t.key
                    ? "border-[#0F3C78] bg-[linear-gradient(135deg,rgba(26,44,114,0.22),rgba(28,110,213,0.18))]"
                    : "border-[var(--line-soft)] hover-glow"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </header>

        {success ? <p className="text-xs text-emerald-300">{success}</p> : null}
        {error ? <p className="text-xs text-rose-300">{error}</p> : null}

        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {tab === "overview" ? (
            <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
              <article className="glass p-4">
                <p className="m-0 text-sm font-semibold">School Snapshot</p>
                <div className="mt-3 grid gap-2 md:grid-cols-4">
                  <MiniStat label="Total Students" value={fmtInt(detail.stats.totalStudents)} />
                  <MiniStat label="Parents" value={fmtInt(detail.stats.parents)} />
                  <MiniStat label="Generated Links" value={fmtInt(detail.stats.intakeLinks)} />
                  <MiniStat label="Invoice Total" value={`INR ${fmtMoney(detail.stats.invoiceTotal)}`} />
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-4">
                  <MiniStat label="Submitted" value={fmtInt(detail.stats.submitted)} />
                  <MiniStat label="Approved" value={fmtInt(detail.stats.approved)} />
                  <MiniStat label="In Print" value={fmtInt(detail.stats.inPrint)} />
                  <MiniStat label="Delivered" value={fmtInt(detail.stats.delivered)} />
                </div>
                <div className="mt-4 rounded-xl border border-[var(--line-soft)]">
                  <div className="border-b border-[var(--line-soft)] px-3 py-2 text-xs font-semibold">
                    School Staff
                  </div>
                  {detail.staff?.length ? (
                    <div className="overflow-auto">
                      <table className="w-full min-w-[620px] text-left text-xs">
                        <thead className="bg-[var(--surface-strong)] text-[var(--text-muted)]">
                          <tr>
                            <th className="px-3 py-2">Name</th>
                            <th className="px-3 py-2">Email</th>
                            <th className="px-3 py-2">Role</th>
                            <th className="px-3 py-2">Active</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.staff.map((s) => (
                            <tr key={s.id} className="border-t border-[var(--line-soft)]">
                              <td className="px-3 py-2">{s.name || "--"}</td>
                              <td className="px-3 py-2">{s.email}</td>
                              <td className="px-3 py-2">{s.role}</td>
                              <td className="px-3 py-2">{s.isActive ? "YES" : "NO"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-3">
                      <EmptyState text="No school staff linked yet." />
                    </div>
                  )}
                </div>
              </article>

              <article className="glass p-4">
                <p className="m-0 text-sm font-semibold">Edit School</p>
                {detailDraft ? (
                  <div className="mt-3 grid gap-2">
                    <InputField label="School Name" value={detailDraft.name} onChange={(v) => setDetailDraft((p) => (p ? { ...p, name: v } : p))} />
                    <InputField label="Email" value={detailDraft.email} onChange={(v) => setDetailDraft((p) => (p ? { ...p, email: v } : p))} />
                    <InputField label="Phone" value={detailDraft.phone} onChange={(v) => setDetailDraft((p) => (p ? { ...p, phone: v } : p))} />
                    <div className="grid grid-cols-2 gap-2">
                      <InputField label="City" value={detailDraft.city} onChange={(v) => setDetailDraft((p) => (p ? { ...p, city: v } : p))} />
                      <InputField label="State" value={detailDraft.state} onChange={(v) => setDetailDraft((p) => (p ? { ...p, state: v } : p))} />
                    </div>
                    <label className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs">
                      <span className="mb-1 block text-[11px] text-[var(--text-muted)]">Status</span>
                      <select
                        value={detailDraft.status}
                        onChange={(e) => setDetailDraft((p) => (p ? { ...p, status: e.target.value as SchoolStatus } : p))}
                        className="w-full bg-transparent outline-none"
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="INACTIVE">INACTIVE</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => void saveSchool()}
                      disabled={loading.saveSchool}
                      className="rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {loading.saveSchool ? "Saving..." : "Save School"}
                    </button>
                  </div>
                ) : null}
              </article>
            </div>
          ) : null}

          {tab === "students" ? (
            <article className="glass p-4">
              <div className="mb-3 rounded-xl border border-[var(--line-soft)]">
                <div className="flex items-center justify-between border-b border-[var(--line-soft)] px-3 py-2">
                  <p className="m-0 text-xs font-semibold">Class-wise Breakdown</p>
                  <button
                    type="button"
                    onClick={() =>
                      exportCsv(
                        `${detail.school.code}-class-summary`,
                        [
                          "Class",
                          "Section",
                          "Total",
                          "Submitted",
                          "School Approved",
                          "Sales Approved",
                          "In Print Queue",
                          "Printed",
                          "Delivered",
                          "Rejected"
                        ],
                        classSummary.map((r) => [
                          r.className,
                          r.section,
                          r.total,
                          r.submitted,
                          r.schoolApproved,
                          r.salesApproved,
                          r.inPrintQueue,
                          r.printed,
                          r.delivered,
                          r.rejected
                        ])
                      )
                    }
                    className="rounded-lg border border-[var(--line-soft)] px-2 py-1 text-xs hover-glow"
                  >
                    <span className="inline-flex items-center gap-1">
                      <Download size={12} /> CSV
                    </span>
                  </button>
                </div>
                {loading.classSummary ? (
                  <Skeleton className="m-3 h-20 rounded-xl" />
                ) : classSummary.length ? (
                  <div className="overflow-auto">
                    <table className="w-full min-w-[1000px] text-left text-xs">
                      <thead className="bg-[var(--surface-strong)] text-[var(--text-muted)]">
                        <tr>
                          <th className="px-3 py-2">Class</th>
                          <th className="px-3 py-2">Section</th>
                          <th className="px-3 py-2">Total</th>
                          <th className="px-3 py-2">Submitted</th>
                          <th className="px-3 py-2">School Approved</th>
                          <th className="px-3 py-2">Sales Approved</th>
                          <th className="px-3 py-2">In Print Queue</th>
                          <th className="px-3 py-2">Printed</th>
                          <th className="px-3 py-2">Delivered</th>
                          <th className="px-3 py-2">Rejected</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classSummary.map((row) => (
                          <tr key={`${row.className}-${row.section}`} className="border-t border-[var(--line-soft)]">
                            <td className="px-3 py-2">{row.className}</td>
                            <td className="px-3 py-2">{row.section}</td>
                            <td className="px-3 py-2">{fmtInt(row.total)}</td>
                            <td className="px-3 py-2">{fmtInt(row.submitted)}</td>
                            <td className="px-3 py-2">{fmtInt(row.schoolApproved)}</td>
                            <td className="px-3 py-2">{fmtInt(row.salesApproved)}</td>
                            <td className="px-3 py-2">{fmtInt(row.inPrintQueue)}</td>
                            <td className="px-3 py-2">{fmtInt(row.printed)}</td>
                            <td className="px-3 py-2">{fmtInt(row.delivered)}</td>
                            <td className="px-3 py-2">{fmtInt(row.rejected)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-3">
                    <EmptyState text="No class summary available yet." />
                  </div>
                )}
              </div>

              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="m-0 text-sm font-semibold">Students</p>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 rounded-lg border border-[var(--line-soft)] px-2 py-1 text-xs">
                    <Search size={12} />
                    <input
                      value={studentQuery}
                      onChange={(e) => setStudentQuery(e.target.value)}
                      placeholder="Search"
                      className="bg-transparent outline-none"
                    />
                  </div>
                  <select
                    value={studentStatus}
                    onChange={(e) => setStudentStatus(e.target.value as StudentStatus | "")}
                    className="rounded-lg border border-[var(--line-soft)] bg-[var(--surface-strong)] px-2 py-1 text-xs outline-none"
                  >
                    <option value="">All Status</option>
                    {WORKFLOW_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                  <select
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                    className="rounded-lg border border-[var(--line-soft)] bg-[var(--surface-strong)] px-2 py-1 text-xs outline-none"
                  >
                    <option value="">All Classes</option>
                    {Array.from(new Set(classSummary.map((r) => r.className)))
                      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
                      .map((cls) => (
                        <option key={cls} value={cls}>
                          {cls}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setStudentsPage(1);
                      void loadStudents(1);
                    }}
                    className="rounded-lg border border-[var(--line-soft)] px-2 py-1 text-xs hover-glow"
                  >
                    <RefreshCcw size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void exportStudentsCsv()}
                    disabled={loading.studentExport}
                    className="rounded-lg border border-[var(--line-soft)] px-2 py-1 text-xs hover-glow"
                  >
                    <span className="inline-flex items-center gap-1">
                      <Download size={12} /> {loading.studentExport ? "Preparing..." : "CSV"}
                    </span>
                  </button>
                </div>
              </div>

              {loading.students ? (
                <Skeleton className="h-52 rounded-xl" />
              ) : students?.rows.length ? (
                <>
                  <div className="overflow-auto rounded-xl border border-[var(--line-soft)]">
                    <table className="w-full min-w-[980px] text-left text-xs">
                      <thead className="bg-[var(--surface-strong)] text-[var(--text-muted)]">
                        <tr>
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2">Class</th>
                          <th className="px-3 py-2">Parent</th>
                          <th className="px-3 py-2">Photo</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Update</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.rows.map((r) => (
                          <tr key={r.id} className="border-t border-[var(--line-soft)] hover:bg-[var(--surface-strong)]/50 transition-colors">
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => setSelectedStudent(r)}
                                className="text-left font-medium text-sky-300 hover:text-sky-200 hover:underline"
                              >
                                {r.fullName}
                              </button>
                            </td>
                            <td className="px-3 py-2">{[r.className, r.section].filter(Boolean).join("-") || "--"}</td>
                            <td className="px-3 py-2">{[r.parentName, r.parentMobile].filter(Boolean).join(" • ")}</td>
                            <td className="px-3 py-2">
                              {r.photoLink ? (
                                <a
                                  href={r.photoLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={buildStudentPhotoFileName(r.fullName, r.photoKey)}
                                  className="inline-flex items-center gap-1 text-sky-300 hover:underline"
                                >
                                  <Link2 size={12} /> View
                                </a>
                              ) : r.photoKey ? (
                                <span className="text-[var(--text-muted)]">Preparing...</span>
                              ) : (
                                "--"
                              )}
                            </td>
                            <td className="px-3 py-2">{r.status}</td>
                            <td className="px-3 py-2">
                              <select
                                value={r.status}
                                onChange={(e) => void updateStudent(r.id, e.target.value as StudentStatus)}
                                disabled={loading.studentUpdate === r.id}
                                className="rounded-md border border-[var(--line-soft)] bg-[var(--surface-strong)] px-2 py-1 outline-none"
                              >
                                {WORKFLOW_STATUSES.map((st) => (
                                  <option key={st} value={st}>
                                    {st}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span>
                      Page {students.page} • {fmtInt(students.total)} rows
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setStudentsPage((p) => Math.max(1, p - 1))}
                        disabled={students.page <= 1}
                        className="rounded-md border border-[var(--line-soft)] px-2 py-1 disabled:opacity-40"
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (students.page * students.pageSize < students.total) setStudentsPage((p) => p + 1);
                        }}
                        disabled={students.page * students.pageSize >= students.total}
                        className="rounded-md border border-[var(--line-soft)] px-2 py-1 disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <EmptyState text="No students found." />
              )}
            </article>
          ) : null}

          {tab === "campaigns" ? (
            <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
              <article className="glass space-y-4 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="m-0 text-sm font-semibold">Create Intake Campaign</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      A compact 2-step workflow for OTP-first intake collection.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    {[1, 2].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setCampaignStep(value as 1 | 2)}
                        className={`rounded-full border px-3 py-1 ${
                          campaignStep === value
                            ? "border-[#1C6ED5] bg-[rgba(28,110,213,0.16)] text-white"
                            : "border-[var(--line-soft)] text-[var(--text-muted)]"
                        }`}
                      >
                        Step {value}
                      </button>
                    ))}
                  </div>
                </div>

                {campaignStep === 1 ? (
                  <div className="space-y-3 rounded-2xl border border-[var(--line-soft)] p-3">
                    <p className="m-0 text-xs font-semibold">Step 1: Campaign Basics</p>
                    <div className="grid gap-2 md:grid-cols-2">
                      <InputField label="Campaign Name" value={campaignForm.campaignName} onChange={(value) => setCampaignForm((prev) => ({ ...prev, campaignName: value }))} />
                      <label className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs">
                        <span className="mb-1 block text-[11px] text-[var(--text-muted)]">Institution Type</span>
                        <select value={campaignForm.institutionType} onChange={(e) => updateCampaignInstitution(e.target.value as InstitutionType)} className="w-full bg-transparent outline-none">
                          <option value="SCHOOL">School</option>
                          <option value="COLLEGE">College</option>
                        </select>
                      </label>
                    </div>
                    <div className="grid gap-2 md:grid-cols-4">
                      <InputField label="Start Date" value={campaignForm.startsAt} onChange={(value) => setCampaignForm((prev) => ({ ...prev, startsAt: value }))} type="date" />
                      <InputField label="Expiry Date" value={campaignForm.expiresAt} onChange={(value) => setCampaignForm((prev) => ({ ...prev, expiresAt: value }))} type="date" />
                      <InputField label="Max Expected Volume" value={campaignForm.maxExpectedVolume} onChange={(value) => setCampaignForm((prev) => ({ ...prev, maxExpectedVolume: value }))} type="number" />
                      <InputField label="Max Records / Link" value={campaignForm.maxStudentsPerParent} onChange={(value) => setCampaignForm((prev) => ({ ...prev, maxStudentsPerParent: value }))} type="number" />
                    </div>
                  </div>
                ) : null}

                {false ? (
                  <div className="space-y-3 rounded-2xl border border-[var(--line-soft)] p-3">
                    <p className="m-0 text-xs text-[var(--text-muted)]">
                      Segment configuration has been removed from this flow.
                    </p>
                  </div>
                ) : null}

                {campaignStep === 2 ? (
                  <div className="space-y-3 rounded-2xl border border-[var(--line-soft)] p-3">
                    <div>
                      <p className="m-0 text-xs font-semibold">Step 2: Data Schema + Submission Rules</p>
                      <p className="m-0 mt-1 text-[11px] text-[var(--text-muted)]">
                        Select only the fields that should appear in the intake form. Full name stays on, and photo capture or upload stays mandatory.
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs text-[var(--text-muted)]">
                      A single secure intake link will be generated for this campaign. Class and division can now be captured directly inside the intake form instead of creating segment rows here.
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-[#1C6ED5] bg-[rgba(28,110,213,0.16)] px-3 py-2 text-xs text-white">
                        Full Name
                      </span>
                      <span className="rounded-full border border-[#1C6ED5] bg-[rgba(28,110,213,0.16)] px-3 py-2 text-xs text-white">
                        Photo Capture / Upload Mandatory
                      </span>
                      {DATA_SCHEMA_FIELDS.filter((field) => field.key !== "fullName" && !(campaignForm.institutionType === "COLLEGE" && field.key === "parentName")).map((field) => (
                        <button
                          key={field.key}
                          type="button"
                          onClick={() => toggleSchemaField(field.key)}
                          className={`rounded-full border px-3 py-2 text-xs ${
                            campaignForm.dataSchema[field.key]
                              ? "border-[#1C6ED5] bg-[rgba(28,110,213,0.16)] text-white"
                              : "border-[var(--line-soft)] text-[var(--text-muted)]"
                          }`}
                        >
                          {field.label}
                        </button>
                      ))}
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs">
                        <span className="mb-1 block text-[11px] text-[var(--text-muted)]">Actor Type</span>
                        <p className="m-0 font-semibold">{campaignForm.submissionModel.actorType}</p>
                      </div>
                      <label className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs">
                        <span className="mb-1 block text-[11px] text-[var(--text-muted)]">Background Rule</span>
                        <select value={campaignForm.photoBgPreference} onChange={(e) => setCampaignForm((prev) => ({ ...prev, photoBgPreference: e.target.value }))} className="w-full bg-transparent outline-none">
                          <option value="PLAIN">PLAIN</option>
                          <option value="LIGHT">LIGHT</option>
                          <option value="NONE">NONE</option>
                        </select>
                      </label>
                      <label className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs">
                        <span className="mb-1 block text-[11px] text-[var(--text-muted)]">Mode</span>
                        <select value={campaignForm.submissionModel.mode} onChange={(e) => setCampaignForm((prev) => ({ ...prev, submissionModel: { ...prev.submissionModel, mode: e.target.value } }))} className="w-full bg-transparent outline-none">
                          {getSubmissionModes(campaignForm.institutionType).map((mode) => (
                            <option key={mode.value} value={mode.value}>{mode.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs">
                        <span className="mb-1 block text-[11px] text-[var(--text-muted)]">Duplicate Policy</span>
                        <select
                          value={campaignForm.submissionModel.duplicatePolicy}
                          onChange={(e) =>
                            setCampaignForm((prev) => ({
                              ...prev,
                              submissionModel: {
                                ...prev.submissionModel,
                                duplicatePolicy: e.target.value as CampaignForm["submissionModel"]["duplicatePolicy"]
                              }
                            }))
                          }
                          className="w-full bg-transparent outline-none"
                        >
                          <option value="ONE_PER_STUDENT">One per mobile per student</option>
                          <option value="ONE_PER_CAMPAIGN">One per mobile per campaign</option>
                          <option value="ALLOW_MULTIPLE">Allow multiple submissions</option>
                        </select>
                      </label>
                      <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs text-[var(--text-muted)]">
                        Mobile OTP verification is always required before the form opens.
                      </div>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <ToggleRow label="Photo Standardization" checked={campaignForm.submissionModel.requirePhotoStandardization} onChange={() => setCampaignForm((prev) => ({ ...prev, submissionModel: { ...prev.submissionModel, requirePhotoStandardization: !prev.submissionModel.requirePhotoStandardization } }))} />
                      <ToggleRow label="Workflow Required" checked={campaignForm.submissionModel.workflowRequired} onChange={() => setCampaignForm((prev) => ({ ...prev, submissionModel: { ...prev.submissionModel, workflowRequired: !prev.submissionModel.workflowRequired } }))} />
                      <ToggleRow label="Approval Required" checked={campaignForm.approvalRequired} onChange={() => setCampaignForm((prev) => ({ ...prev, approvalRequired: !prev.approvalRequired }))} />
                      <ToggleRow
                        label="Allow Mobile Edit After Verification"
                        checked={campaignForm.submissionModel.allowMobileEditAfterVerification}
                        onChange={() =>
                          setCampaignForm((prev) => ({
                            ...prev,
                            submissionModel: {
                              ...prev.submissionModel,
                              allowMobileEditAfterVerification: !prev.submissionModel.allowMobileEditAfterVerification
                            }
                          }))
                        }
                      />
                      {campaignForm.institutionType === "COLLEGE" ? (
                        <ToggleRow label="Bulk Upload Enabled" checked={campaignForm.submissionModel.bulkUploadEnabled} onChange={() => setCampaignForm((prev) => ({ ...prev, submissionModel: { ...prev.submissionModel, bulkUploadEnabled: !prev.submissionModel.bulkUploadEnabled } }))} />
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="flex items-center justify-between gap-2">
                  <button type="button" onClick={() => setCampaignStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2) : prev))} disabled={campaignStep === 1} className="rounded-xl border border-[var(--line-soft)] px-3 py-2 text-xs disabled:opacity-40">
                    Back
                  </button>
                  {campaignStep < 2 ? (
                    <button type="button" onClick={advanceCampaignStep} className="rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-3 py-2 text-xs font-semibold text-white">
                      Next
                    </button>
                  ) : (
                    <button type="button" onClick={() => void createCampaign()} disabled={loading.campaignCreate} className="rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
                      {loading.campaignCreate ? "Creating Campaign..." : "Create Campaign & Generate Links"}
                    </button>
                  )}
                </div>
              </article>

              <article className="space-y-4">
                <div className="glass p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="m-0 text-sm font-semibold">Live Intake Control Center</p>
                      <p className="m-0 mt-1 text-xs text-[var(--text-muted)]">
                        Every campaign shows expected, submitted, approved, rejected, and pending counts per segment.
                      </p>
                    </div>
                  <button
                    type="button"
                    onClick={() =>
                      exportCsv(
                        `${detail.school.code}-campaign-dashboard`,
                        ["Campaign", "Segment", "Expected", "Submitted", "Approved", "Rejected", "Pending", "Links"],
                        validCampaigns.flatMap((campaign) =>
                          campaign.targetSegments.map((segment) => [
                            campaign.name,
                            segment.label,
                            segment.expectedVolume,
                            segment.submitted,
                            segment.approved,
                            segment.rejected,
                            segment.pending,
                            segment.links.length
                          ])
                        )
                      )
                    }
                    className="rounded-lg border border-[var(--line-soft)] px-2 py-1 text-xs hover-glow"
                  >
                    <span className="inline-flex items-center gap-1"><Download size={12} /> CSV</span>
                  </button>
                </div>
                </div>
                {loading.campaigns ? (
                  <Skeleton className="h-56 rounded-xl" />
                ) : validCampaigns.length ? (
                  <div className="max-h-[24rem] space-y-2 overflow-auto">
                    {validCampaigns.map((l) => {
                      const url = l.links[0]
                        ? `${publicOrigin}/parent/intake?token=${encodeURIComponent(l.links[0].token)}`
                        : "";
                      return (
                        <div key={l.id} className="rounded-lg border border-[var(--line-soft)] px-2 py-2 text-xs">
                          <p className="m-0 font-medium">
                            {(l.targetSegments[0]?.label || "Open Intake Link")} • {l.photoBgPreference}
                          </p>
                          <p className="m-0 mt-1 text-[var(--text-muted)]">
                            {fmtInt(l.totals.generatedLinks)} links • {fmtInt(l.totals.submitted)} submitted •{" "}
                            {fmtInt(l.totals.approved)} approved • {fmtInt(l.totals.pending)} pending
                          </p>
                          <p className="m-0 mt-1 text-[var(--text-muted)]">
                            Timeline {formatDate(l.startsAt)} to {formatDate(l.expiresAt)}
                          </p>
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => copyToClipboard(url)}
                              className="rounded-md border border-[var(--line-soft)] px-2 py-1 text-[11px] hover-glow"
                            >
                              <span className="inline-flex items-center gap-1"><Copy size={11} /> Copy URL</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => window.open(url, "_blank")}
                              className="rounded-md border border-[var(--line-soft)] px-2 py-1 text-[11px] hover-glow"
                            >
                              <span className="inline-flex items-center gap-1"><Link2 size={11} /> Open</span>
                            </button>
                          </div>
                          <div className="mt-3 overflow-auto rounded-xl border border-[var(--line-soft)]">
                            <table className="w-full min-w-[720px] text-left text-[11px]">
                              <thead className="bg-[var(--surface-strong)] text-[var(--text-muted)]">
                                <tr>
                                  <th className="px-2 py-2">Segment</th>
                                  <th className="px-2 py-2">Expected</th>
                                  <th className="px-2 py-2">Submitted</th>
                                  <th className="px-2 py-2">Approved</th>
                                  <th className="px-2 py-2">Rejected</th>
                                  <th className="px-2 py-2">Pending</th>
                                </tr>
                              </thead>
                              <tbody>
                                {l.targetSegments.map((segment) => (
                                  <tr key={segment.segmentKey} className="border-t border-[var(--line-soft)]">
                                    <td className="px-2 py-2">
                                      <p className="m-0 font-medium">{segment.label}</p>
                                      <p className="m-0 mt-1 text-[10px] text-[var(--text-muted)]">
                                        {segment.primaryValue?.toUpperCase() === "ALL"
                                          ? "Open intake across the selected intake form fields"
                                          : `${segment.primaryLabel}: ${segment.primaryValue}${segment.secondaryValue ? ` • ${segment.secondaryLabel}: ${segment.secondaryValue}` : ""}`}
                                      </p>
                                    </td>
                                    <td className="px-2 py-2">{fmtInt(segment.expectedVolume)}</td>
                                    <td className="px-2 py-2">{fmtInt(segment.submitted)}</td>
                                    <td className="px-2 py-2">{fmtInt(segment.approved)}</td>
                                    <td className="px-2 py-2">{fmtInt(segment.rejected)}</td>
                                    <td className="px-2 py-2">{fmtInt(segment.pending)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState text="No intake campaigns yet. Create one to auto-generate child links per class or segment." />
                )}
              </article>
            </div>
          ) : null}

          {tab === "invoices" ? (
            <article className="space-y-4">
              <div className="glass p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="m-0 text-sm font-semibold">Billing Reconciliation</p>
                  <div className="flex items-center gap-2 text-xs">
                    <label className="rounded-lg border border-[var(--line-soft)] bg-[var(--surface-strong)] px-2 py-1">
                      <span className="mr-1 text-[var(--text-muted)]">Start</span>
                      <input
                        type="date"
                        value={billingRange.start}
                        onChange={(e) => setBillingRange((p) => ({ ...p, start: e.target.value }))}
                        className="bg-transparent outline-none"
                      />
                    </label>
                    <label className="rounded-lg border border-[var(--line-soft)] bg-[var(--surface-strong)] px-2 py-1">
                      <span className="mr-1 text-[var(--text-muted)]">End</span>
                      <input
                        type="date"
                        value={billingRange.end}
                        onChange={(e) => setBillingRange((p) => ({ ...p, end: e.target.value }))}
                        className="bg-transparent outline-none"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        void loadReconciliation();
                        void loadInvoices();
                      }}
                      className="rounded-lg border border-[var(--line-soft)] px-2 py-1 hover-glow"
                    >
                      <RefreshCcw size={12} />
                    </button>
                  </div>
                </div>

                {loading.recon ? (
                  <Skeleton className="mt-3 h-36 rounded-xl" />
                ) : recon ? (
                  <div className="mt-3 space-y-3">
                    <div className="grid gap-2 md:grid-cols-6">
                      <MiniStat label="Invoices" value={fmtInt(recon.totals.invoiceCount)} />
                      <MiniStat label="Invoiced" value={`INR ${fmtMoney(recon.totals.invoiced)}`} />
                      <MiniStat label="Collected" value={`INR ${fmtMoney(recon.totals.collected)}`} />
                      <MiniStat label="Outstanding" value={`INR ${fmtMoney(recon.totals.outstanding)}`} />
                      <MiniStat label="Overdue" value={`INR ${fmtMoney(recon.totals.overdue)}`} />
                      <MiniStat label="Overdue Count" value={fmtInt(recon.totals.overdueCount)} />
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <SimpleTable
                        title="Aging"
                        headers={["Bucket", "Count", "Amount"]}
                        rows={recon.aging.map((a) => [a.bucket, fmtInt(a.count), `INR ${fmtMoney(a.amount)}`])}
                      />
                      <SimpleTable
                        title="Status"
                        headers={["Status", "Count", "Outstanding"]}
                        rows={recon.byStatus.map((s) => [s.status, fmtInt(s.count), `INR ${fmtMoney(s.outstanding)}`])}
                      />
                    </div>
                  </div>
                ) : (
                  <EmptyState text="No billing data." />
                )}
              </div>

              <div className="glass p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="m-0 text-sm font-semibold">Invoices</p>
                  <button
                    type="button"
                    onClick={() =>
                      exportCsv(
                        `${detail.school.code}-invoices`,
                        ["Invoice", "Status", "Total", "Paid", "Issued", "Due"],
                        invoices.map((i) => [
                          i.invoiceNo,
                          i.status,
                          i.totalAmount,
                          i.amountPaid,
                          formatDate(i.issuedAt),
                          i.dueAt ? formatDate(i.dueAt) : ""
                        ])
                      )
                    }
                    className="rounded-lg border border-[var(--line-soft)] px-2 py-1 text-xs hover-glow"
                  >
                    <span className="inline-flex items-center gap-1"><Download size={12} /> CSV</span>
                  </button>
                </div>
                {loading.invoices ? (
                  <Skeleton className="h-48 rounded-xl" />
                ) : invoices.length ? (
                  <div className="overflow-auto rounded-xl border border-[var(--line-soft)]">
                    <table className="w-full min-w-[900px] text-left text-xs">
                      <thead className="bg-[var(--surface-strong)] text-[var(--text-muted)]">
                        <tr>
                          <th className="px-3 py-2">Invoice</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Total</th>
                          <th className="px-3 py-2">Paid</th>
                          <th className="px-3 py-2">Issued</th>
                          <th className="px-3 py-2">Due</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((i) => (
                          <tr key={i.id} className="border-t border-[var(--line-soft)]">
                            <td className="px-3 py-2">{i.invoiceNo}</td>
                            <td className="px-3 py-2">{i.status}</td>
                            <td className="px-3 py-2">INR {fmtMoney(i.totalAmount)}</td>
                            <td className="px-3 py-2">INR {fmtMoney(i.amountPaid)}</td>
                            <td className="px-3 py-2">{formatDate(i.issuedAt)}</td>
                            <td className="px-3 py-2">{i.dueAt ? formatDate(i.dueAt) : "--"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState text="No invoices found." />
                )}
              </div>
            </article>
          ) : null}

          {tab === "audit" ? (
            <article className="glass p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="m-0 text-sm font-semibold">Audit Trail</p>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <input
                    value={auditEntityType}
                    onChange={(e) => setAuditEntityType(e.target.value)}
                    placeholder="Entity type (optional)"
                    className="rounded-lg border border-[var(--line-soft)] bg-[var(--surface-strong)] px-2 py-1 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setAuditPage(1);
                      void loadAudits(1);
                    }}
                    className="rounded-lg border border-[var(--line-soft)] px-2 py-1 hover-glow"
                  >
                    <RefreshCcw size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      exportCsv(
                        `${detail.school.code}-audit`,
                        ["Time", "Entity", "Entity Id", "Action", "Actor", "Role"],
                        (audits?.rows || []).map((a) => [
                          formatDateTime(a.createdAt),
                          a.entityType,
                          a.entityId,
                          a.action,
                          a.actorUser?.email || "",
                          a.actorUser?.role || ""
                        ])
                      )
                    }
                    className="rounded-lg border border-[var(--line-soft)] px-2 py-1 hover-glow"
                  >
                    <span className="inline-flex items-center gap-1"><Download size={12} /> CSV</span>
                  </button>
                </div>
              </div>

              {loading.audits ? (
                <Skeleton className="h-48 rounded-xl" />
              ) : audits?.rows.length ? (
                <>
                  <div className="overflow-auto rounded-xl border border-[var(--line-soft)]">
                    <table className="w-full min-w-[940px] text-left text-xs">
                      <thead className="bg-[var(--surface-strong)] text-[var(--text-muted)]">
                        <tr>
                          <th className="px-3 py-2">Time</th>
                          <th className="px-3 py-2">Entity</th>
                          <th className="px-3 py-2">Entity ID</th>
                          <th className="px-3 py-2">Action</th>
                          <th className="px-3 py-2">Actor</th>
                          <th className="px-3 py-2">Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {audits.rows.map((a) => (
                          <tr key={a.id} className="border-t border-[var(--line-soft)]">
                            <td className="px-3 py-2">{formatDateTime(a.createdAt)}</td>
                            <td className="px-3 py-2">{a.entityType}</td>
                            <td className="px-3 py-2">{a.entityId}</td>
                            <td className="px-3 py-2">{a.action}</td>
                            <td className="px-3 py-2">{a.actorUser?.email || "--"}</td>
                            <td className="px-3 py-2">{a.actorUser?.role || "--"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span>
                      Page {audits.page} • {fmtInt(audits.total)} rows
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                        disabled={audits.page <= 1}
                        className="rounded-md border border-[var(--line-soft)] px-2 py-1 disabled:opacity-40"
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (audits.page * audits.pageSize < audits.total) setAuditPage((p) => p + 1);
                        }}
                        disabled={audits.page * audits.pageSize >= audits.total}
                        className="rounded-md border border-[var(--line-soft)] px-2 py-1 disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <EmptyState text="No audit rows found." />
              )}
            </article>
          ) : null}
        </motion.section>
      </div>

      {/* ── Student detail slide-over ── */}
      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          workflowStatuses={WORKFLOW_STATUSES}
          onStatusChange={(status) => {
            void updateStudent(selectedStudent.id, status);
            setSelectedStudent((s) => s ? { ...s, status } : s);
          }}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </main>
  );
}

function SchoolLoader() {
  return (
    <main className="min-h-screen px-6 py-8 text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1680px] space-y-3">
        <div className="glass p-4">
          <div className="skeleton h-6 w-64 rounded-md" />
          <div className="skeleton mt-3 h-10 w-full rounded-xl" />
        </div>
        <div className="glass p-4">
          <div className="skeleton h-80 rounded-xl" />
        </div>
      </div>
    </main>
  );
}

function buildCampaignForm(institutionType: InstitutionType, schoolName = ""): CampaignForm {
  const descriptor = getInstitutionDescriptor(institutionType);
  const now = new Date();
  const expiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const schoolDefaults = institutionType === "SCHOOL";
  return {
    campaignName: schoolName ? `${schoolName} ${now.getFullYear()} ${descriptor.label} Drive` : "",
    institutionType,
    maxExpectedVolume: "",
    startsAt: isoDate(now),
    expiresAt: isoDate(expiry),
    dataSchema: {
      fullName: true,
      photo: true,
      className: schoolDefaults,
      division: schoolDefaults,
      rollNumber: schoolDefaults,
      dob: schoolDefaults,
      bloodGroup: schoolDefaults,
      parentName: institutionType === "SCHOOL",
      mobileNumber: true,
      emergencyNumber: schoolDefaults,
      fullAddress: schoolDefaults,
      aadhaarNumber: schoolDefaults
    },
    submissionModel: {
      mode: descriptor.defaultMode,
      actorType: descriptor.actorType,
      requirePhotoStandardization: true,
      requireParentOtp: true,
      distributionChannels: descriptor.defaultChannels,
      bulkUploadEnabled: institutionType !== "SCHOOL",
      intakeLinkOptional: institutionType === "COLLEGE",
      workflowRequired: true,
      allowMobileEditAfterVerification: false,
      duplicatePolicy: "ONE_PER_STUDENT"
    },
    approvalRequired: true,
    maxStudentsPerParent: "3",
    photoBgPreference: "PLAIN"
  };
}

function getInstitutionDescriptor(institutionType: InstitutionType) {
  if (institutionType === "COLLEGE") {
    return {
      label: "College",
      primaryLabel: "Department",
      secondaryLabel: "Year",
      audience: "STUDENT" as IntakeAudience,
      actorType: "STUDENT" as const,
      defaultMode: "STUDENT_SELF_FILL",
      defaultChannels: ["WHATSAPP", "SMS"]
    };
  }
  if (institutionType === "COMPANY") {
    return {
      label: "Corporate",
      primaryLabel: "Department",
      secondaryLabel: "Role",
      audience: "EMPLOYEE" as IntakeAudience,
      actorType: "STAFF" as const,
      defaultMode: "EMPLOYEE_SELF_FILL",
      defaultChannels: ["EMAIL", "WHATSAPP"]
    };
  }
  if (institutionType === "COACHING_INSTITUTE") {
    return {
      label: "Coaching Institute",
      primaryLabel: "Batch",
      secondaryLabel: "Section",
      audience: "STUDENT" as IntakeAudience,
      actorType: "STUDENT" as const,
      defaultMode: "STUDENT_SELF_FILL",
      defaultChannels: ["WHATSAPP", "SMS"]
    };
  }
  return {
    label: "School",
    primaryLabel: "Class",
    secondaryLabel: "Division",
    audience: "PARENT" as IntakeAudience,
    actorType: "PARENT" as const,
    defaultMode: "PARENT_DRIVEN",
    defaultChannels: ["WHATSAPP", "SMS"]
  };
}

function getSubmissionModes(institutionType: InstitutionType) {
  if (institutionType === "COLLEGE") {
    return [
      { value: "STUDENT_SELF_FILL", label: "Student Self-Fill" },
      { value: "EXCEL_UPLOAD", label: "Excel Upload" }
    ];
  }
  if (institutionType === "COMPANY") {
    return [
      { value: "EMPLOYEE_SELF_FILL", label: "Employee Self-Fill" },
      { value: "BULK_UPLOAD", label: "Bulk Upload" }
    ];
  }
  if (institutionType === "COACHING_INSTITUTE") {
    return [
      { value: "STUDENT_SELF_FILL", label: "Student Self-Fill" },
      { value: "BULK_UPLOAD", label: "Bulk Upload" }
    ];
  }
  return [
    { value: "PARENT_DRIVEN", label: "Parent Driven" },
    { value: "SCHOOL_ASSISTED", label: "School Assisted" }
  ];
}

function ToggleRow({
  label,
  checked,
  onChange,
  disabled = false
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-xs ${
        checked
          ? "border-[#1C6ED5] bg-[rgba(28,110,213,0.12)]"
          : "border-[var(--line-soft)] bg-[var(--surface-strong)]"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <span>{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-[10px] ${checked ? "bg-[#1C6ED5] text-white" : "bg-transparent text-[var(--text-muted)]"}`}>
        {checked ? "YES" : "NO"}
      </span>
    </button>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs">
      <span className="mb-1 block text-[11px] text-[var(--text-muted)]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent outline-none"
      />
    </label>
  );
}

function StatusBadge({
  label,
  tone
}: {
  label: string;
  tone: "good" | "info" | "muted";
}) {
  const toneClass =
    tone === "good"
      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
      : tone === "info"
        ? "border-sky-400/40 bg-sky-500/10 text-sky-200"
        : "border-[var(--line-soft)] bg-[var(--surface-strong)] text-[var(--text-muted)]";
  return <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${toneClass}`}>{label}</span>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2">
      <p className="m-0 text-[11px] text-[var(--text-muted)]">{label}</p>
      <p className="m-0 mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function SimpleTable({
  title,
  headers,
  rows
}: {
  title: string;
  headers: string[];
  rows: Array<Array<string>>;
}) {
  return (
    <div className="rounded-xl border border-[var(--line-soft)]">
      <div className="border-b border-[var(--line-soft)] px-3 py-2 text-xs font-semibold">{title}</div>
      <div className="overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[var(--surface-strong)] text-[var(--text-muted)]">
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={`${title}-${idx}`} className="border-t border-[var(--line-soft)]">
                {r.map((cell, ci) => (
                  <td key={`${title}-${idx}-${ci}`} className="px-3 py-2">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--line-soft)] px-3 py-6 text-center text-xs text-[var(--text-muted)]">
      {text}
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton ${className || ""}`} />;
}

function fmtInt(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0);
}

function fmtMoney(value: number) {
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(
    Math.round(value || 0)
  );
}

function formatInstitutionLabel(value?: InstitutionType | string | null) {
  if (!value) return "--";
  if (value === "COACHING_INSTITUTE") return "Coaching Institute";
  if (value === "COMPANY") return "Corporate";
  return value
    .toString()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatAudienceLabel(value?: IntakeAudience | string | null) {
  if (!value) return "--";
  if (value === "PARENT") return "Parent";
  if (value === "STUDENT") return "Student";
  if (value === "EMPLOYEE") return "Employee";
  return formatKeyLabel(value);
}

function formatModeLabel(value?: string | null) {
  if (!value) return "--";
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatKeyLabel(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return `${date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  })} ${date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
}

function defaultMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: isoDate(start),
    end: isoDate(end)
  };
}

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ── Student Detail Modal ──────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  DRAFT:           "border-gray-600/50  bg-gray-600/10  text-gray-400",
  SUBMITTED:       "border-blue-500/40  bg-blue-500/10  text-blue-300",
  SCHOOL_APPROVED: "border-cyan-500/40  bg-cyan-500/10  text-cyan-300",
  SALES_APPROVED:  "border-indigo-500/40 bg-indigo-500/10 text-indigo-300",
  IN_PRINT_QUEUE:  "border-amber-500/40 bg-amber-500/10 text-amber-300",
  PRINTED:         "border-lime-500/40  bg-lime-500/10  text-lime-300",
  DELIVERED:       "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  REJECTED:        "border-red-500/40   bg-red-500/10   text-red-400",
};

function StudentDetailModal({
  student,
  workflowStatuses,
  onStatusChange,
  onClose,
}: {
  student: SchoolDetailStudent;
  workflowStatuses: StudentStatus[];
  onStatusChange: (s: StudentStatus) => void;
  onClose: () => void;
}) {
  const badgeClass = STATUS_COLOR[student.status] || STATUS_COLOR.DRAFT;
  const classLabel = [student.className, student.section].filter(Boolean).join(" – ") || "—";
  const parentLabel = [student.parentName, student.parentMobile].filter(Boolean).join(" • ") || "—";

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div className="relative w-full max-w-2xl rounded-2xl border border-[var(--line-soft)] bg-[var(--surface)] shadow-2xl overflow-hidden">

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-strong)] hover:text-white transition"
        >
          <X size={16} />
        </button>

        <div className="flex flex-col sm:flex-row">

          {/* ── Left: Photo ── */}
          <div className="flex shrink-0 items-center justify-center bg-[var(--surface-strong)] p-6 sm:w-52">
            {student.photoLink ? (
              <div className="overflow-hidden rounded-xl shadow-lg" style={{ width: 160, aspectRatio: "3/4" }}>
                <img
                  src={student.photoLink}
                  alt={student.fullName}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--line-soft)] text-[var(--text-muted)]"
                style={{ width: 160, aspectRatio: "3/4" }}
              >
                <User size={32} className="opacity-30" />
                <span className="text-[10px]">No photo</span>
              </div>
            )}
          </div>

          {/* ── Right: Details ── */}
          <div className="flex flex-1 flex-col gap-4 p-5">

            {/* Name + status */}
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)] leading-tight">
                {student.fullName}
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${badgeClass}`}>
                  {student.status.replace(/_/g, " ")}
                </span>
                {student.duplicateFlag && (
                  <span className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-300">
                    <AlertTriangle size={10} /> Duplicate
                  </span>
                )}
              </div>
            </div>

            {/* Detail grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              <DetailRow label="Class / Section" value={classLabel} />
              <DetailRow label="Roll Number"     value={student.rollNumber || "—"} />
              <DetailRow label="Parent / Guardian" value={parentLabel} span />
              <DetailRow label="Submitted"       value={formatDate(student.createdAt)} />
              <DetailRow label="Student ID"      value={student.id.slice(0, 12) + "…"} mono />
            </div>

            {/* Photo link */}
            {student.photoLink && (
              <a
                href={student.photoLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-[11px] font-medium text-sky-300 hover:bg-sky-500/20 transition"
              >
                <Link2 size={11} /> Open full-size photo
              </a>
            )}

            {/* Status update */}
            <div className="mt-auto">
              <p className="mb-1 text-[10px] text-[var(--text-muted)]">Update status</p>
              <select
                value={student.status}
                onChange={(e) => onStatusChange(e.target.value as StudentStatus)}
                className="w-full rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs outline-none focus:border-blue-500"
              >
                {workflowStatuses.map((st) => (
                  <option key={st} value={st}>{st.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  span = false,
  mono = false,
}: {
  label: string;
  value: string;
  span?: boolean;
  mono?: boolean;
}) {
  return (
    <div className={span ? "col-span-2" : ""}>
      <p className="text-[10px] text-[var(--text-muted)]">{label}</p>
      <p className={`mt-0.5 font-medium text-[var(--text-primary)] ${mono ? "font-mono text-[10px]" : ""}`}>
        {value}
      </p>
    </div>
  );
}




