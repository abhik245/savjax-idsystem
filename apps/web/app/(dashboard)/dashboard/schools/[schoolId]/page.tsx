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
  ShieldCheck
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
type StudentStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "SCHOOL_APPROVED"
  | "SALES_APPROVED"
  | "IN_PRINT_QUEUE"
  | "PRINTED"
  | "DELIVERED"
  | "REJECTED";

type TabKey = "overview" | "students" | "intake-links" | "invoices" | "audit";

type SchoolDetailStudent = {
  id: string;
  fullName: string;
  className?: string | null;
  section?: string | null;
  rollNumber?: string | null;
  parentName?: string | null;
  parentMobile?: string | null;
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

type IntakeLinkRow = {
  id: string;
  token: string;
  className: string;
  section: string;
  maxStudentsPerParent: number;
  photoBgPreference: string;
  expiresAt: string;
  createdAt: string;
  isActive: boolean;
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

type IntakeLinkForm = {
  className: string;
  section: string;
  maxStudentsPerParent: string;
  photoBgPreference: string;
  expiresAt: string;
};

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "students", label: "Students" },
  { key: "intake-links", label: "Intake Links" },
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

export default function SchoolDrillPage() {
  const router = useRouter();
  const params = useParams<{ schoolId: string }>();
  const schoolId = useMemo(() => {
    const raw = params?.schoolId;
    return Array.isArray(raw) ? raw[0] : raw || "";
  }, [params]);
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api/v2";

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

  const [links, setLinks] = useState<IntakeLinkRow[]>([]);
  const [linkForm, setLinkForm] = useState<IntakeLinkForm>({
    className: "ALL",
    section: "ALL",
    maxStudentsPerParent: "3",
    photoBgPreference: "WHITE",
    expiresAt: ""
  });

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
    classSummary: false,
    studentUpdate: "",
    links: false,
    linkCreate: false,
    invoices: false,
    recon: false,
    audits: false
  });

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

  async function loadAll() {
    setLoading((p) => ({ ...p, detail: true }));
    setError("");
    try {
      await Promise.all([
        loadDetail(),
        loadClassSummary(),
        loadStudents(1),
        loadLinks(),
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
      setStudents(res);
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

  async function loadLinks() {
    setLoading((p) => ({ ...p, links: true }));
    try {
      setLinks(await apiRequest<IntakeLinkRow[]>(`/intake-links?schoolId=${encodeURIComponent(schoolId)}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load intake links");
      clearFlash();
    } finally {
      setLoading((p) => ({ ...p, links: false }));
    }
  }

  async function createLink() {
    setLoading((p) => ({ ...p, linkCreate: true }));
    try {
      const created = await apiRequest<IntakeLinkRow>(`/schools/${encodeURIComponent(schoolId)}/intake-links`, {
        method: "POST",
        body: JSON.stringify({
          className: linkForm.className || "ALL",
          section: linkForm.section || "ALL",
          maxStudentsPerParent: Number(linkForm.maxStudentsPerParent || "3"),
          photoBgPreference: linkForm.photoBgPreference || "WHITE",
          expiresAt: linkForm.expiresAt || undefined
        })
      });
      setLinks((prev) => [created, ...prev]);
      setSuccess("Intake link created.");
      await loadDetail();
      await loadAudits(1);
      clearFlash();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create intake link");
      clearFlash();
    } finally {
      setLoading((p) => ({ ...p, linkCreate: false }));
    }
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
                  <MiniStat label="Intake Links" value={fmtInt(detail.stats.intakeLinks)} />
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
                    onClick={() =>
                      exportCsv(
                        `${detail.school.code}-students`,
                        ["Name", "Class", "Section", "Parent", "Mobile", "Status", "Created"],
                        (students?.rows || []).map((r) => [
                          r.fullName,
                          r.className || "",
                          r.section || "",
                          r.parentName || "",
                          r.parentMobile || "",
                          r.status,
                          formatDateTime(r.createdAt)
                        ])
                      )
                    }
                    className="rounded-lg border border-[var(--line-soft)] px-2 py-1 text-xs hover-glow"
                  >
                    <span className="inline-flex items-center gap-1"><Download size={12} /> CSV</span>
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
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Update</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.rows.map((r) => (
                          <tr key={r.id} className="border-t border-[var(--line-soft)]">
                            <td className="px-3 py-2">{r.fullName}</td>
                            <td className="px-3 py-2">{[r.className, r.section].filter(Boolean).join("-") || "--"}</td>
                            <td className="px-3 py-2">{[r.parentName, r.parentMobile].filter(Boolean).join(" • ")}</td>
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

          {tab === "intake-links" ? (
            <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
              <article className="glass p-4">
                <p className="m-0 text-sm font-semibold">Create Intake Link</p>
                <div className="mt-3 grid gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <InputField label="Class" value={linkForm.className} onChange={(v) => setLinkForm((p) => ({ ...p, className: v }))} />
                    <InputField label="Section" value={linkForm.section} onChange={(v) => setLinkForm((p) => ({ ...p, section: v }))} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <InputField
                      label="Max Students"
                      value={linkForm.maxStudentsPerParent}
                      onChange={(v) => setLinkForm((p) => ({ ...p, maxStudentsPerParent: v }))}
                    />
                    <label className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs">
                      <span className="mb-1 block text-[11px] text-[var(--text-muted)]">Photo BG</span>
                      <select
                        value={linkForm.photoBgPreference}
                        onChange={(e) => setLinkForm((p) => ({ ...p, photoBgPreference: e.target.value }))}
                        className="w-full bg-transparent outline-none"
                      >
                        <option value="WHITE">WHITE</option>
                        <option value="LIGHT_BLUE">LIGHT_BLUE</option>
                        <option value="NONE">NONE</option>
                      </select>
                    </label>
                    <label className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs">
                      <span className="mb-1 block text-[11px] text-[var(--text-muted)]">Expires</span>
                      <input
                        type="date"
                        value={linkForm.expiresAt}
                        onChange={(e) => setLinkForm((p) => ({ ...p, expiresAt: e.target.value }))}
                        className="w-full bg-transparent outline-none"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => void createLink()}
                    disabled={loading.linkCreate}
                    className="rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {loading.linkCreate ? "Creating..." : "Create Link"}
                  </button>
                </div>
              </article>

              <article className="glass p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="m-0 text-sm font-semibold">Intake Links</p>
                  <button
                    type="button"
                    onClick={() =>
                      exportCsv(
                        `${detail.school.code}-intake-links`,
                        ["Token", "Class", "Section", "BG", "Max Students", "Expires", "Active"],
                        links.map((l) => [
                          l.token,
                          l.className,
                          l.section,
                          l.photoBgPreference,
                          l.maxStudentsPerParent,
                          formatDate(l.expiresAt),
                          l.isActive ? "YES" : "NO"
                        ])
                      )
                    }
                    className="rounded-lg border border-[var(--line-soft)] px-2 py-1 text-xs hover-glow"
                  >
                    <span className="inline-flex items-center gap-1"><Download size={12} /> CSV</span>
                  </button>
                </div>
                {loading.links ? (
                  <Skeleton className="h-40 rounded-xl" />
                ) : links.length ? (
                  <div className="max-h-[24rem] space-y-2 overflow-auto">
                    {links.map((l) => {
                      const url = `${window.location.origin}/parent/intake?token=${encodeURIComponent(l.token)}`;
                      return (
                        <div key={l.id} className="rounded-lg border border-[var(--line-soft)] px-2 py-2 text-xs">
                          <p className="m-0 font-medium">
                            {l.className}-{l.section} • {l.photoBgPreference}
                          </p>
                          <p className="m-0 mt-1 text-[var(--text-muted)]">{l.token}</p>
                          <p className="m-0 mt-1 text-[var(--text-muted)]">Expires {formatDate(l.expiresAt)}</p>
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
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState text="No intake links created yet." />
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




