"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Barcode,
  Bell,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Copy,
  ClipboardList,
  Download,
  Eye,
  FileBarChart2,
  Filter,
  Image as ImageIcon,
  IdCard,
  LayoutDashboard,
  Minus,
  Logs,
  Moon,
  Plus,
  QrCode,
  Printer,
  Receipt,
  RefreshCcw,
  Search,
  Settings,
  Square,
  Sun,
  Trash2,
  Type,
  Users,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/ui/brand-logo";
import { applyTheme as applyThemePreference, resolveTheme, ThemeMode } from "@/lib/theme";

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

type ModuleKey =
  | "overview"
  | "schools"
  | "users"
  | "templates"
  | "workflow"
  | "print-ops"
  | "reports"
  | "billing"
  | "settings"
  | "audit-logs";
type SchoolStatus = "ACTIVE" | "INACTIVE";
type MetricKey = "submissions" | "approvals" | "pending_approvals" | "revenue";
type StudentStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "SCHOOL_APPROVED"
  | "SALES_APPROVED"
  | "IN_PRINT_QUEUE"
  | "PRINTED"
  | "DELIVERED"
  | "REJECTED";

type OverviewFilters = {
  start: string;
  end: string;
  salesOwnerId: string;
  region: string;
  status: SchoolStatus | "";
};

type OverviewKpis = {
  totalSchools: number;
  activeSchools: number;
  pendingApprovals: number;
  totalStudentsAllTime: number;
  studentsMTD: number;
  revenueMTD: number;
  collectionsMTD: number;
  outstandingAR: number;
  grossMarginMTD: number | null;
  currency: string;
  serverTime: string;
};

type TimePoint = { date: string; value: number };
type SalesRow = {
  salesOwnerId: string | null;
  salesOwnerName: string;
  revenue: number;
  schoolsActive: number;
  studentsMTD: number;
};
type DrillRow = { schoolId: string; schoolName: string; value: number; salesOwnerName: string };
type SchoolRow = {
  id: string;
  name: string;
  code: string;
  email: string;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  status?: SchoolStatus;
  salesOwner?: { id: string; name?: string | null; email: string } | null;
  createdAt?: string;
};
type UserRow = {
  id: string;
  name?: string | null;
  email: string;
  role: RoleKey;
  isActive: boolean;
  schoolId?: string | null;
  school?: { id: string; name: string; code: string } | null;
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
type RetentionPolicy = {
  otpRetentionHours: number;
  resetTokenRetentionHours: number;
  sessionRetentionDays: number;
  artifactRetentionDays: number;
};
type RetentionSummaryResponse = {
  policy: RetentionPolicy;
  summary: {
    otpChallenges: {
      expired: number;
      consumed: number;
    };
    resetTokens: {
      expired: number;
      used: number;
    };
    authSessions: {
      expired: number;
      revoked: number;
    };
    generatedArtifacts: {
      renderBatches: number;
      printJobs: number;
      total: number;
    };
  };
};
type RetentionPurgeResponse = {
  dryRun: boolean;
  policy: RetentionPolicy;
  counts: {
    otpChallenges: {
      expired: number;
      consumed: number;
    };
    resetTokens: {
      expired: number;
      used: number;
    };
    authSessions: {
      expired: number;
      revoked: number;
    };
    generatedArtifacts: {
      renderBatches: number;
      printJobs: number;
      filesDeleted: number;
    };
  };
};
type AuthAnomalyRow = {
  id: string;
  action: string;
  createdAt: string;
  ipAddress?: string | null;
  entityId?: string | null;
  actorUser?: {
    id: string;
    email: string;
    role: RoleKey;
  } | null;
};
type AuthAnomaliesResponse = {
  recent: AuthAnomalyRow[];
  hotIps: Array<{ ip: string; count: number }>;
};
type SecurityEventRow = {
  id: string;
  entityType: string;
  entityId?: string | null;
  action: string;
  createdAt: string;
  ipAddress?: string | null;
  actorUser?: {
    id: string;
    email: string;
    role: RoleKey;
  } | null;
};
type SecurityEventFeedResponse = {
  recent: SecurityEventRow[];
  actionCounts: Array<{ action: string; count: number }>;
};
type MaskPolicyRow = {
  id: string;
  schoolId: string;
  fieldKey: string;
  rolesAllowed: string[];
  maskStrategy: string;
  isActive: boolean;
};
type MaskPolicyForm = {
  schoolId: string;
  fieldKey: string;
  rolesAllowed: string;
  maskStrategy: string;
  isActive: boolean;
};
type WorkflowRow = {
  schoolId: string;
  schoolName: string;
  schoolCode: string;
  schoolEmail: string;
  submitted: number;
  approved: number;
  inPrint: number;
  printed: number;
  delivered: number;
  rejected: number;
  totalStudents: number;
  completionPercent: number;
  revenueInr: number;
};
type WorkflowTotals = {
  schools: number;
  totalStudents: number;
  submitted: number;
  approved: number;
  inPrint: number;
  printed: number;
  delivered: number;
  rejected: number;
  revenueInr: number;
};
type ReportsResponse = { rows: WorkflowRow[]; totals: WorkflowTotals };
type PrintJobRow = {
  id: string;
  status: string;
  notes?: string | null;
  createdAt: string;
  printFileUrl?: string | null;
  school?: { id: string; name: string; code: string } | null;
  assignedTo?: { id: string; email: string; role: string } | null;
  _count?: { items: number };
};
type AuditRow = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  createdAt: string;
  actorUser?: { id: string; email: string; role: string } | null;
};
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
};
type SchoolStudentListResponse = {
  page: number;
  pageSize: number;
  total: number;
  rows: SchoolDetailStudent[];
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
type TemplateRow = {
  id: string;
  templateCode?: string | null;
  name: string;
  cardType: string;
  institutionType: string;
  status: string;
  isActive: boolean;
  isDefault: boolean;
  version: number;
  lastSnapshotVersion: number;
  updatedAt: string;
};
type TemplateAssignmentRow = {
  id: string;
  templateId: string;
  scope: string;
  cardType: string;
  className?: string | null;
  section?: string | null;
  intakeLinkId?: string | null;
  isDefault: boolean;
  isActive: boolean;
  priority: number;
};
type RenderBatchRow = {
  id: string;
  status: string;
  totalRecords: number;
  successCount: number;
  failedCount: number;
  artifactUrl?: string | null;
  createdAt: string;
  template?: { id: string; name: string; templateCode?: string | null } | null;
};

type SchoolForm = {
  name: string;
  code: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  principalName: string;
  principalEmail: string;
  principalPhone: string;
  status: SchoolStatus;
  salesOwnerId: string;
  adminEmail: string;
  adminPassword: string;
};
type UserForm = {
  email: string;
  password: string;
  role: RoleKey;
  phone: string;
};
type InvoiceForm = {
  schoolId: string;
  amount: string;
  taxPercent: string;
  dueAt: string;
  notes: string;
};
type DispatchForm = { studentIds: string; assignedToId: string; notes: string };
type IntakeLinkForm = {
  className: string;
  section: string;
  maxStudentsPerParent: string;
  photoBgPreference: string;
  expiresAt: string;
};
type TemplateForm = {
  name: string;
  templateCode: string;
  cardType: string;
  institutionType: string;
  isActive: boolean;
  isDefault: boolean;
  notes: string;
  mappingJson: string;
};
type AssignmentForm = {
  templateId: string;
  scope: string;
  cardType: string;
  className: string;
  section: string;
  intakeLinkId: string;
  isDefault: boolean;
  isActive: boolean;
  priority: string;
  notes: string;
};
type RenderBatchForm = {
  templateId: string;
  className: string;
  section: string;
  studentStatus: string;
  onlyApproved: boolean;
  outputFormat: "PDF" | "JSON";
  pageSize: "A4" | "A3" | "CUSTOM";
  customPageMm: string;
  grid: string;
  sideMode: "FRONT_ONLY" | "BACK_ONLY" | "FRONT_BACK";
};
type TemplateToken = { key: string; label: string };
type StudioElementType = "text" | "photo" | "qr" | "barcode" | "shape" | "line";
type StudioTextAlign = "left" | "center" | "right";
type StudioElement = {
  id: string;
  type: StudioElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  token?: string;
  color?: string;
  background?: string;
  borderColor?: string;
  borderRadius?: number;
  fontSize?: number;
  fontWeight?: number;
  textAlign?: StudioTextAlign;
  locked?: boolean;
};
type StudioLayout = {
  width: number;
  height: number;
  grid: number;
  elements: StudioElement[];
};
type TemplateDetail = {
  id: string;
  name: string;
  templateCode?: string | null;
  status: string;
  cardWidthMm?: number | null;
  cardHeightMm?: number | null;
  orientation?: string | null;
  mappingJson?: Record<string, unknown> | null;
  frontLayoutJson?: Record<string, unknown> | null;
  backLayoutJson?: Record<string, unknown> | null;
};
type StudioDragState = {
  id: string;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
} | null;

const MODULES: Array<{ key: ModuleKey; label: string; icon: typeof LayoutDashboard }> = [
  { key: "overview", label: "Dashboard", icon: LayoutDashboard },
  { key: "schools", label: "Schools", icon: Building2 },
  { key: "users", label: "Users", icon: Users },
  { key: "templates", label: "ID Card Templates", icon: IdCard },
  { key: "workflow", label: "Workflow", icon: ClipboardList },
  { key: "print-ops", label: "Print Ops", icon: Printer },
  { key: "reports", label: "Reports", icon: FileBarChart2 },
  { key: "billing", label: "Billing", icon: Receipt },
  { key: "settings", label: "Settings", icon: Settings },
  { key: "audit-logs", label: "Audit Logs", icon: Logs }
];

const USER_ROLES: RoleKey[] = [
  "SUPER_ADMIN",
  "COMPANY_ADMIN",
  "SALES_PERSON",
  "OPERATIONS_ADMIN",
  "HR_ADMIN",
  "SALES",
  "PRINTING",
  "PRINT_OPS",
  "HR",
  "FINANCE",
  "SUPPORT"
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

const CARD_LAYOUT_PRESETS: Array<{ key: string; label: string; width: number; height: number }> = [
  { key: "86x54H", label: "86mm x 54mm (Horizontal) ISO Standard", width: 86, height: 54 },
  { key: "54x86V", label: "54mm x 86mm (Vertical) ISO Standard", width: 54, height: 86 },
  { key: "70x100V", label: "70mm x 100mm (Vertical)", width: 70, height: 100 },
  { key: "80x110V", label: "80mm x 110mm (Vertical)", width: 80, height: 110 },
  { key: "54x130V", label: "54mm x 130mm (Vertical)", width: 54, height: 130 },
  { key: "102x140V", label: "102mm x 140mm (Vertical)", width: 102, height: 140 }
];

const RBAC_MODULES: ModuleKey[] = [
  "overview",
  "schools",
  "users",
  "templates",
  "workflow",
  "print-ops",
  "reports",
  "billing",
  "settings",
  "audit-logs"
];

const RBAC_MATRIX: Array<{ role: RoleKey; modules: ModuleKey[] }> = [
  { role: "SUPER_ADMIN", modules: [...RBAC_MODULES] },
  {
    role: "COMPANY_ADMIN",
    modules: [
      "overview",
      "schools",
      "users",
      "templates",
      "workflow",
      "print-ops",
      "reports",
      "billing",
      "settings",
      "audit-logs"
    ]
  },
  {
    role: "SALES_PERSON",
    modules: ["overview", "schools", "templates", "workflow", "print-ops", "reports", "billing"]
  },
  {
    role: "OPERATIONS_ADMIN",
    modules: [
      "overview",
      "schools",
      "users",
      "templates",
      "workflow",
      "print-ops",
      "reports",
      "billing",
      "settings",
      "audit-logs"
    ]
  },
  { role: "HR_ADMIN", modules: ["overview", "users", "reports", "settings", "audit-logs"] },
  { role: "HR", modules: ["users", "reports"] },
  { role: "SALES", modules: ["overview", "schools", "templates", "workflow", "print-ops", "reports", "billing"] },
  { role: "PRINTING", modules: ["workflow", "print-ops"] },
  { role: "PRINT_OPS", modules: ["workflow", "print-ops"] },
  { role: "FINANCE", modules: ["overview", "billing", "reports"] },
  { role: "SUPPORT", modules: ["schools", "workflow", "reports"] },
  { role: "SCHOOL_ADMIN", modules: ["templates", "workflow"] },
  { role: "SCHOOL_STAFF", modules: ["workflow"] },
  { role: "PARENT", modules: [] }
];

function modulesForRole(role: RoleKey) {
  return RBAC_MATRIX.find((entry) => entry.role === role)?.modules || [];
}

function defaultModuleForRole(role: RoleKey): ModuleKey {
  const allowed = modulesForRole(role);
  return allowed[0] || "workflow";
}

function createDefaultStudioLayout(): StudioLayout {
  return {
    width: 540,
    height: 340,
    grid: 4,
    elements: [
      {
        id: `title-${Date.now()}`,
        type: "text",
        x: 24,
        y: 22,
        width: 320,
        height: 34,
        text: "{{school_name}}",
        color: "#0f172a",
        fontSize: 20,
        fontWeight: 700,
        textAlign: "left",
        background: "transparent",
        borderColor: "transparent",
        borderRadius: 0
      },
      {
        id: `name-${Date.now()}`,
        type: "text",
        x: 24,
        y: 76,
        width: 300,
        height: 28,
        text: "{{student_name}}",
        color: "#1e293b",
        fontSize: 18,
        fontWeight: 600,
        textAlign: "left",
        background: "transparent",
        borderColor: "transparent",
        borderRadius: 0
      },
      {
        id: `class-${Date.now()}`,
        type: "text",
        x: 24,
        y: 114,
        width: 240,
        height: 24,
        text: "Class {{class}} - {{section}}",
        color: "#334155",
        fontSize: 14,
        fontWeight: 500,
        textAlign: "left",
        background: "transparent",
        borderColor: "transparent",
        borderRadius: 0
      },
      {
        id: `photo-${Date.now()}`,
        type: "photo",
        x: 390,
        y: 56,
        width: 126,
        height: 158,
        borderColor: "#334155",
        borderRadius: 10,
        background: "#e2e8f0"
      },
      {
        id: `qr-${Date.now()}`,
        type: "qr",
        x: 390,
        y: 232,
        width: 64,
        height: 64,
        borderColor: "#334155",
        borderRadius: 8,
        background: "#f8fafc"
      }
    ]
  };
}

function parseStudioLayout(input: unknown): StudioLayout {
  if (input && typeof input === "object") {
    const cast = input as Partial<StudioLayout>;
    const elements = Array.isArray(cast.elements)
      ? cast.elements
          .filter((item): item is StudioElement => !!item && typeof item === "object" && "id" in item && "type" in item)
          .map((item) => ({
            ...item,
            x: Number(item.x ?? 0),
            y: Number(item.y ?? 0),
            width: Math.max(Number(item.width ?? 120), 8),
            height: Math.max(Number(item.height ?? 40), 8),
            borderRadius: Number(item.borderRadius ?? 0),
            fontSize: Number(item.fontSize ?? 14),
            fontWeight: Number(item.fontWeight ?? 500),
            textAlign: (item.textAlign as StudioTextAlign) || "left",
            color: item.color || "#0f172a",
            background: item.background || "transparent",
            borderColor: item.borderColor || "transparent",
            locked: !!item.locked
          }))
      : [];
    if (elements.length) {
      return {
        width: Number(cast.width ?? 540),
        height: Number(cast.height ?? 340),
        grid: Number(cast.grid ?? 4),
        elements
      };
    }
  }
  return createDefaultStudioLayout();
}

function extractTemplateTokens(text: string) {
  const tokens = Array.from(text.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)).map(
    (match) => match[1]
  );
  return [...new Set(tokens.filter(Boolean))];
}

function buildMappingFromStudio(front: StudioLayout, back: StudioLayout) {
  const serializedFront = front.elements.map((element) => ({
    id: element.id,
    type: element.type,
    text: element.text || "",
    token: element.token || null,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height
  }));
  const serializedBack = back.elements.map((element) => ({
    id: element.id,
    type: element.type,
    text: element.text || "",
    token: element.token || null,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height
  }));
  const discoveredTokens = [
    ...serializedFront.flatMap((element) => [
      ...(element.token ? [element.token] : []),
      ...extractTemplateTokens(element.text)
    ]),
    ...serializedBack.flatMap((element) => [
      ...(element.token ? [element.token] : []),
      ...extractTemplateTokens(element.text)
    ])
  ];
  return {
    schema: "SAVJAX_TEMPLATE_STUDIO_V1",
    front: { elements: serializedFront },
    back: { elements: serializedBack },
    discoveredTokens: [...new Set(discoveredTokens)]
  };
}

function mmToCanvasSize(widthMm: number, heightMm: number) {
  const safeWidth = Number.isFinite(widthMm) && widthMm > 0 ? widthMm : 86;
  const safeHeight = Number.isFinite(heightMm) && heightMm > 0 ? heightMm : 54;
  const longSidePx = 560;
  if (safeWidth >= safeHeight) {
    return {
      width: longSidePx,
      height: Math.max(260, Math.round((safeHeight / safeWidth) * longSidePx))
    };
  }
  return {
    width: Math.max(260, Math.round((safeWidth / safeHeight) * longSidePx)),
    height: longSidePx
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api/v2";

  const [booting, setBooting] = useState(true);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [role, setRole] = useState<RoleKey>("SUPER_ADMIN");
  const [collapsed, setCollapsed] = useState(false);
  const [moduleKey, setModuleKey] = useState<ModuleKey>("overview");
  const [globalQuery, setGlobalQuery] = useState("");
  const [globalResults, setGlobalResults] = useState<SchoolRow[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAddSchoolForm, setShowAddSchoolForm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [filters, setFilters] = useState<OverviewFilters>(defaultMonthRange());
  const [kpis, setKpis] = useState<OverviewKpis | null>(null);
  const [submissions, setSubmissions] = useState<TimePoint[]>([]);
  const [approvals, setApprovals] = useState<TimePoint[]>([]);
  const [revenue, setRevenue] = useState<TimePoint[]>([]);
  const [salesRows, setSalesRows] = useState<SalesRow[]>([]);

  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [reports, setReports] = useState<ReportsResponse | null>(null);
  const [printJobs, setPrintJobs] = useState<PrintJobRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [billingSummary, setBillingSummary] = useState<BillingReconciliation | null>(null);
  const [retentionSummary, setRetentionSummary] = useState<RetentionSummaryResponse | null>(null);
  const [retentionResult, setRetentionResult] = useState<RetentionPurgeResponse | null>(null);
  const [authAnomalies, setAuthAnomalies] = useState<AuthAnomaliesResponse | null>(null);
  const [securityEvents, setSecurityEvents] = useState<SecurityEventFeedResponse | null>(null);
  const [maskPolicies, setMaskPolicies] = useState<MaskPolicyRow[]>([]);
  const [activePrintJobActionId, setActivePrintJobActionId] = useState<string | null>(null);
  const [retentionForm, setRetentionForm] = useState({
    otpRetentionHours: "24",
    resetTokenRetentionHours: "24",
    sessionRetentionDays: "30",
    artifactRetentionDays: "14"
  });
  const [securitySchoolId, setSecuritySchoolId] = useState("");
  const [maskPolicyForm, setMaskPolicyForm] = useState<MaskPolicyForm>({
    schoolId: "",
    fieldKey: "parentMobile",
    rolesAllowed: "SUPER_ADMIN,COMPANY_ADMIN,SCHOOL_ADMIN",
    maskStrategy: "PARTIAL",
    isActive: true
  });
  const [revokeUserId, setRevokeUserId] = useState("");
  const [revokeMfa, setRevokeMfa] = useState(false);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditEntityType, setAuditEntityType] = useState("");
  const [auditActorId, setAuditActorId] = useState("");
  const [auditPageSize] = useState(20);

  const [schoolForm, setSchoolForm] = useState<SchoolForm>({
    name: "",
    code: "",
    email: "",
    phone: "",
    city: "",
    state: "",
    principalName: "",
    principalEmail: "",
    principalPhone: "",
    status: "ACTIVE",
    salesOwnerId: "",
    adminEmail: "",
    adminPassword: ""
  });
  const [userForm, setUserForm] = useState<UserForm>({
    email: "",
    password: "",
    role: "SALES_PERSON",
    phone: ""
  });
  const [invoiceForm, setInvoiceForm] = useState<InvoiceForm>({
    schoolId: "",
    amount: "",
    taxPercent: "18",
    dueAt: "",
    notes: ""
  });
  const [dispatchForm, setDispatchForm] = useState<DispatchForm>({
    studentIds: "",
    assignedToId: "",
    notes: ""
  });
  const [templateSchoolId, setTemplateSchoolId] = useState("");
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [templateAssignments, setTemplateAssignments] = useState<TemplateAssignmentRow[]>([]);
  const [renderBatches, setRenderBatches] = useState<RenderBatchRow[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateForm, setTemplateForm] = useState<TemplateForm>({
    name: "",
    templateCode: "",
    cardType: "STUDENT",
    institutionType: "SCHOOL",
    isActive: false,
    isDefault: false,
    notes: "",
    mappingJson: JSON.stringify(
      {
        front: {
          title: "{{school_name}}",
          subtitle: "{{student_name}}",
          class: "{{class}}",
          section: "{{section}}",
          id: "{{student_id}}"
        },
        back: {
          parent: "{{parent_name}}",
          contact: "{{parent_mobile}}",
          address: "{{address}}"
        }
      },
      null,
      2
    )
  });
  const [assignmentForm, setAssignmentForm] = useState<AssignmentForm>({
    templateId: "",
    scope: "SCHOOL_DEFAULT",
    cardType: "STUDENT",
    className: "",
    section: "",
    intakeLinkId: "",
    isDefault: true,
    isActive: true,
    priority: "100",
    notes: ""
  });
  const [renderBatchForm, setRenderBatchForm] = useState<RenderBatchForm>({
    templateId: "",
    className: "",
    section: "",
    studentStatus: "",
    onlyApproved: true,
    outputFormat: "PDF",
    pageSize: "A4",
    customPageMm: "",
    grid: "3x8",
    sideMode: "FRONT_BACK"
  });
  const [templateDetail, setTemplateDetail] = useState<TemplateDetail | null>(null);
  const [templateTokens, setTemplateTokens] = useState<TemplateToken[]>([]);
  const [studioSide, setStudioSide] = useState<"front" | "back">("front");
  const [studioFrontLayout, setStudioFrontLayout] = useState<StudioLayout>(createDefaultStudioLayout());
  const [studioBackLayout, setStudioBackLayout] = useState<StudioLayout>({
    ...createDefaultStudioLayout(),
    elements: [
      {
        id: `address-${Date.now()}`,
        type: "text",
        x: 24,
        y: 28,
        width: 360,
        height: 76,
        text: "Address: {{address}}",
        color: "#1e293b",
        fontSize: 14,
        fontWeight: 500,
        textAlign: "left",
        background: "transparent",
        borderColor: "transparent",
        borderRadius: 0
      },
      {
        id: `parent-${Date.now()}`,
        type: "text",
        x: 24,
        y: 120,
        width: 330,
        height: 30,
        text: "Parent: {{parent_name}}",
        color: "#1e293b",
        fontSize: 14,
        fontWeight: 500,
        textAlign: "left",
        background: "transparent",
        borderColor: "transparent",
        borderRadius: 0
      },
      {
        id: `contact-${Date.now()}`,
        type: "text",
        x: 24,
        y: 158,
        width: 330,
        height: 28,
        text: "Contact: {{parent_mobile}}",
        color: "#334155",
        fontSize: 13,
        fontWeight: 500,
        textAlign: "left",
        background: "transparent",
        borderColor: "transparent",
        borderRadius: 0
      },
      {
        id: `barcode-${Date.now()}`,
        type: "barcode",
        x: 370,
        y: 248,
        width: 140,
        height: 44,
        borderColor: "#334155",
        borderRadius: 6,
        background: "#f8fafc"
      }
    ]
  });
  const [studioSelectedElementId, setStudioSelectedElementId] = useState("");
  const [studioDrag, setStudioDrag] = useState<StudioDragState>(null);
  const [studioPreview, setStudioPreview] = useState<Record<string, unknown> | null>(null);
  const [studioWarnings, setStudioWarnings] = useState<string[]>([]);
  const [studioSaving, setStudioSaving] = useState(false);
  const [studioLayoutPreset, setStudioLayoutPreset] = useState(CARD_LAYOUT_PRESETS[0].key);
  const [studioWidthMm, setStudioWidthMm] = useState("86");
  const [studioHeightMm, setStudioHeightMm] = useState("54");
  const [studioProjectType, setStudioProjectType] = useState<"SINGLE_SIDED" | "BOTH_SIDED">("SINGLE_SIDED");
  const [studioZoom, setStudioZoom] = useState("100");
  const [studioDisplayMode, setStudioDisplayMode] = useState<"CROPPED" | "FIT">("CROPPED");
  const [studioFontFamily, setStudioFontFamily] = useState("Product Sans");
  const [studioTextMode, setStudioTextMode] = useState("Vector");
  const [studioDegree, setStudioDegree] = useState("0");
  const studioCanvasRef = useRef<HTMLDivElement | null>(null);
  const refreshInFlightRef = useRef<Promise<string | null> | null>(null);
  const authRedirectingRef = useRef(false);
  const [schoolSearch, setSchoolSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<RoleKey | "">("");

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<SchoolDetailResponse | null>(null);
  const [detailDraft, setDetailDraft] = useState<{
    name: string;
    email: string;
    phone: string;
    city: string;
    state: string;
    status: SchoolStatus;
  } | null>(null);
  const [savingSchoolDetail, setSavingSchoolDetail] = useState(false);
  const [savingStudentId, setSavingStudentId] = useState("");
  const [detailStudents, setDetailStudents] = useState<SchoolStudentListResponse | null>(null);
  const [detailStudentsPage, setDetailStudentsPage] = useState(1);
  const [detailStudentQuery, setDetailStudentQuery] = useState("");
  const [detailStudentStatus, setDetailStudentStatus] = useState<StudentStatus | "">("");
  const [detailStudentsLoading, setDetailStudentsLoading] = useState(false);
  const [detailIntakeLinks, setDetailIntakeLinks] = useState<IntakeLinkRow[]>([]);
  const [detailIntakeLoading, setDetailIntakeLoading] = useState(false);
  const [detailCreateLinkLoading, setDetailCreateLinkLoading] = useState(false);
  const [detailIntakeForm, setDetailIntakeForm] = useState<IntakeLinkForm>({
    className: "ALL",
    section: "ALL",
    maxStudentsPerParent: "3",
    photoBgPreference: "WHITE",
    expiresAt: ""
  });

  const [drilldown, setDrilldown] = useState<{
    open: boolean;
    metric: MetricKey;
    date: string;
    rows: DrillRow[];
    loading: boolean;
    error: string;
  }>({
    open: false,
    metric: "submissions",
    date: "",
    rows: [],
    loading: false,
    error: ""
  });

  const [loading, setLoading] = useState({
    overview: true,
    schools: false,
    users: false,
    reports: false,
    printOps: false,
    templates: false,
    templateAssignments: false,
    renderBatches: false,
    invoices: false,
    billingSummary: false,
    retentionSummary: false,
    retentionPurge: false,
    authAnomalies: false,
    securityEvents: false,
    maskPolicies: false,
    upsertMaskPolicy: false,
    revokeSessions: false,
    audit: false,
    createSchool: false,
    createUser: false,
    createInvoice: false,
    dispatch: false,
    createTemplate: false,
    upsertTemplateAssignment: false,
    createRenderBatch: false
  });

  const roleModules = useMemo(() => modulesForRole(role), [role]);
  const visibleModules = useMemo(
    () => MODULES.filter((module) => roleModules.includes(module.key)),
    [roleModules]
  );
  const moduleLabel = MODULES.find((m) => m.key === moduleKey)?.label || "Dashboard";
  const isControlAdmin = role === "SUPER_ADMIN" || role === "COMPANY_ADMIN";
  const canViewRetention = ["SUPER_ADMIN", "COMPANY_ADMIN", "OPERATIONS_ADMIN", "HR_ADMIN"].includes(role);
  const canRunRetentionPurge = ["SUPER_ADMIN", "COMPANY_ADMIN", "OPERATIONS_ADMIN"].includes(role);
  const canViewSecurityOperations = ["SUPER_ADMIN", "COMPANY_ADMIN", "OPERATIONS_ADMIN", "HR_ADMIN"].includes(role);
  const canManageMaskPolicies = ["SUPER_ADMIN", "COMPANY_ADMIN", "OPERATIONS_ADMIN", "HR_ADMIN"].includes(role);
  const canRevokeSessions = ["SUPER_ADMIN", "COMPANY_ADMIN", "OPERATIONS_ADMIN", "HR_ADMIN"].includes(role);
  const canManagePrintArtifacts = [
    "SUPER_ADMIN",
    "COMPANY_ADMIN",
    "OPERATIONS_ADMIN",
    "PRINTING",
    "PRINT_OPS",
    "SCHOOL_ADMIN"
  ].includes(role);
  const salesOwners = useMemo(
    () =>
      users
        .filter((u) => u.role === "SALES_PERSON" || u.role === "SALES")
        .map((u) => ({ id: u.id, name: u.name?.trim() || u.email })),
    [users]
  );
  const printingUsers = useMemo(
    () => users.filter((u) => u.role === "PRINTING" || u.role === "PRINT_OPS"),
    [users]
  );
  const securityManagedUsers = useMemo(
    () => users.filter((u) => u.role !== "PARENT"),
    [users]
  );
  const filteredSchools = useMemo(() => {
    const q = schoolSearch.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
    );
  }, [schools, schoolSearch]);
  const filteredUsers = useMemo(
    () => (userRoleFilter ? users.filter((u) => u.role === userRoleFilter) : users),
    [users, userRoleFilter]
  );
  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: keyof OverviewFilters; label: string }> = [];
    if (filters.salesOwnerId) {
      const ownerName = salesOwners.find((s) => s.id === filters.salesOwnerId)?.name || "Sales Person";
      chips.push({ key: "salesOwnerId", label: `Sales Person: ${ownerName}` });
    }
    if (filters.region) chips.push({ key: "region", label: `Region: ${filters.region}` });
    if (filters.status) chips.push({ key: "status", label: `Status: ${filters.status}` });
    return chips;
  }, [filters.region, filters.salesOwnerId, filters.status, salesOwners]);
  const studioLayout = useMemo(
    () => (studioSide === "front" ? studioFrontLayout : studioBackLayout),
    [studioBackLayout, studioFrontLayout, studioSide]
  );
  const studioSelectedElement = useMemo(
    () => studioLayout.elements.find((element) => element.id === studioSelectedElementId) || null,
    [studioLayout.elements, studioSelectedElementId]
  );
  const studioSelectedMetrics = useMemo(() => {
    if (!studioSelectedElement) return null;
    const cardWidthMm = Number(studioWidthMm) || 86;
    const cardHeightMm = Number(studioHeightMm) || 54;
    return {
      left: ((studioSelectedElement.x / Math.max(studioLayout.width, 1)) * cardWidthMm).toFixed(3),
      top: ((studioSelectedElement.y / Math.max(studioLayout.height, 1)) * cardHeightMm).toFixed(3),
      width: ((studioSelectedElement.width / Math.max(studioLayout.width, 1)) * cardWidthMm).toFixed(3),
      height: ((studioSelectedElement.height / Math.max(studioLayout.height, 1)) * cardHeightMm).toFixed(3)
    };
  }, [studioHeightMm, studioLayout.height, studioLayout.width, studioSelectedElement, studioWidthMm]);

  useEffect(() => {
    const selectedTheme = resolveTheme();
    applyTheme(selectedTheme, { persist: false, withTransition: false });

    let cancelled = false;
    async function hydrateSession() {
      try {
        const me = await apiRequest<{ user: { role: RoleKey } }>("/auth/me");
        const currentRole = me.user?.role || ((localStorage.getItem("company_role") as RoleKey) || "SUPER_ADMIN");
        localStorage.setItem("company_role", currentRole);
        if (!cancelled) {
          setRole(currentRole);
          setModuleKey(defaultModuleForRole(currentRole));
        }
        if (currentRole === "PARENT") {
          router.replace("/parent/portal");
          return;
        }
      } catch {
        clearLocalSession();
        router.replace("/login");
        return;
      } finally {
        if (!cancelled) setBooting(false);
      }
    }
    void hydrateSession();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (booting) return;
    if (!roleModules.length) return;
    if (roleModules.includes("overview")) void loadOverview();
    if (roleModules.includes("schools")) void loadSchools();
    if (roleModules.includes("users")) void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booting, roleModules.join("|")]);

  useEffect(() => {
    if (booting) return;
    if (!roleModules.includes(moduleKey)) return;
    if (moduleKey === "workflow" || moduleKey === "reports") void loadReports();
    if (moduleKey === "print-ops") void loadPrintJobs();
    if (moduleKey === "templates" && templateSchoolId) {
      void Promise.all([
        loadTemplates(templateSchoolId),
        loadTemplateAssignments(templateSchoolId),
        loadRenderBatches(templateSchoolId)
      ]);
    }
    if (moduleKey === "billing") {
      void Promise.all([loadInvoices(), loadBillingSummary()]);
    }
    if (moduleKey === "settings" && canViewRetention) void loadRetentionSummary();
    if (moduleKey === "settings" && canViewSecurityOperations) {
      void loadAuthAnomalies();
      void loadSecurityEvents();
      if (securitySchoolId) void loadMaskPolicies(securitySchoolId);
    }
    if (moduleKey === "audit-logs") void loadAuditLogs(auditPage);
    if (moduleKey === "users") void loadUsers();
    if (moduleKey === "schools") void loadSchools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    booting,
    moduleKey,
    auditPage,
    roleModules.join("|"),
    templateSchoolId,
    securitySchoolId,
    canViewRetention,
    canViewSecurityOperations
  ]);

  useEffect(() => {
    if (!roleModules.length) return;
    if (roleModules.includes(moduleKey)) return;
    setModuleKey(roleModules[0]);
  }, [moduleKey, roleModules]);

  useEffect(() => {
    if (!selectedTemplateId) return;
    setAssignmentForm((prev) => ({ ...prev, templateId: selectedTemplateId }));
    setRenderBatchForm((prev) => ({ ...prev, templateId: selectedTemplateId }));
    void loadTemplateDetail(selectedTemplateId);
  }, [selectedTemplateId]);

  useEffect(() => {
    if (!studioLayout.elements.length) {
      if (studioSelectedElementId) setStudioSelectedElementId("");
      return;
    }
    const exists = studioLayout.elements.some((element) => element.id === studioSelectedElementId);
    if (!exists) setStudioSelectedElementId(studioLayout.elements[0].id);
  }, [studioLayout.elements, studioSelectedElementId]);

  useEffect(() => {
    if (moduleKey !== "templates" || !roleModules.includes("templates")) return;
    if (templateTokens.length) return;
    void loadTemplateTokens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleKey, roleModules.join("|"), templateTokens.length]);

  useEffect(() => {
    if (!studioDrag) return;
    const onMove = (event: MouseEvent) => {
      const layout = studioSide === "front" ? studioFrontLayout : studioBackLayout;
      const grid = Math.max(layout.grid || 4, 1);
      const target = layout.elements.find((item) => item.id === studioDrag.id);
      if (!target || target.locked) return;

      const nextXRaw = studioDrag.originX + (event.clientX - studioDrag.startX);
      const nextYRaw = studioDrag.originY + (event.clientY - studioDrag.startY);
      const nextX = Math.round(nextXRaw / grid) * grid;
      const nextY = Math.round(nextYRaw / grid) * grid;
      const maxX = layout.width - target.width;
      const maxY = layout.height - target.height;

      updateStudioElement(studioDrag.id, {
        x: Math.max(0, Math.min(nextX, maxX)),
        y: Math.max(0, Math.min(nextY, maxY))
      });
    };

    const onUp = () => setStudioDrag(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studioDrag, studioSide, studioFrontLayout, studioBackLayout]);

  useEffect(() => {
    if (templateSchoolId || !schools.length) return;
    setTemplateSchoolId(schools[0].id);
  }, [schools, templateSchoolId]);

  useEffect(() => {
    if (securitySchoolId || !schools.length) return;
    const defaultSchoolId = schools[0].id;
    setSecuritySchoolId(defaultSchoolId);
    setMaskPolicyForm((prev) => ({ ...prev, schoolId: prev.schoolId || defaultSchoolId }));
  }, [schools, securitySchoolId]);

  useEffect(() => {
    if (!securitySchoolId) return;
    setMaskPolicyForm((prev) => ({ ...prev, schoolId: securitySchoolId }));
  }, [securitySchoolId]);

  useEffect(() => {
    if (!detailModalOpen || !detailData?.school.id) return;
    void loadDetailStudents(detailData.school.id, detailStudentsPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailModalOpen, detailData?.school.id, detailStudentsPage, detailStudentStatus]);

  useEffect(() => {
    if (moduleKey !== "billing" || !roleModules.includes("billing")) return;
    void loadBillingSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleKey, roleModules.join("|"), filters.start, filters.end]);

  useEffect(() => {
    if (booting) return;
    if (!roleModules.includes("overview")) return;
    if (moduleKey !== "overview") return;
    const timer = window.setTimeout(() => {
      void loadOverview();
    }, 260);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booting, filters.start, filters.end, filters.salesOwnerId, filters.region, filters.status, roleModules.join("|"), moduleKey]);

  useEffect(() => {
    if (booting) return;
    if (!roleModules.includes("schools")) return;
    if (globalQuery.trim().length < 2) {
      setGlobalResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        setGlobalResults((await apiRequest<SchoolRow[]>(`/schools?q=${encodeURIComponent(globalQuery.trim())}`)).slice(0, 8));
      } catch {
        setGlobalResults([]);
      }
    }, 220);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booting, globalQuery, roleModules.join("|")]);

  function clearLocalSession() {
    localStorage.removeItem("company_access_token");
    localStorage.removeItem("company_refresh_token");
    localStorage.removeItem("company_role");
    localStorage.removeItem("company_user");
  }

  function redirectToLoginOnce() {
    if (authRedirectingRef.current) return;
    authRedirectingRef.current = true;
    clearLocalSession();
    router.replace("/login");
  }

  async function refreshAccessTokenOnce(refreshToken?: string | null): Promise<string | null> {
    if (refreshInFlightRef.current) return refreshInFlightRef.current;
    refreshInFlightRef.current = (async () => {
      const refresh = await fetch(`${apiBase}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(refreshToken ? { refreshToken } : {})
      });
      const refreshData = await refresh.json().catch(() => ({}));
      if (refresh.ok && refreshData.accessToken) {
        localStorage.removeItem("company_access_token");
        localStorage.removeItem("company_refresh_token");
        return String(refreshData.accessToken);
      }
      clearLocalSession();
      return null;
    })().finally(() => {
      refreshInFlightRef.current = null;
    });
    return refreshInFlightRef.current;
  }

  async function apiRequest<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
    const accessToken = localStorage.getItem("company_access_token");
    const refreshToken = localStorage.getItem("company_refresh_token");
    const headers: Record<string, string> = { ...((options.headers || {}) as Record<string, string>) };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    if (!headers["Content-Type"] && options.body) headers["Content-Type"] = "application/json";

    const res = await fetch(`${apiBase}${path}`, { ...options, headers, credentials: "include" });
    const data = await res.json().catch(() => ({}));

    if (res.status === 401 && retry) {
      const nextAccess = await refreshAccessTokenOnce(refreshToken);
      if (nextAccess) return apiRequest<T>(path, options, false);
      redirectToLoginOnce();
      throw new Error("Session expired. Please login again.");
    }

    if (res.status === 401) {
      redirectToLoginOnce();
      throw new Error("Session expired. Please login again.");
    }

    if (!res.ok) throw new Error(data.message || data.error || `Request failed ${res.status}`);
    return data as T;
  }

  async function apiFetchRaw(path: string, options: RequestInit = {}, retry = true): Promise<Response> {
    const accessToken = localStorage.getItem("company_access_token");
    const refreshToken = localStorage.getItem("company_refresh_token");
    const headers: Record<string, string> = { ...((options.headers || {}) as Record<string, string>) };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const res = await fetch(`${apiBase}${path}`, { ...options, headers, credentials: "include" });

    if (res.status === 401 && retry) {
      const nextAccess = await refreshAccessTokenOnce(refreshToken);
      if (nextAccess) return apiFetchRaw(path, options, false);
      redirectToLoginOnce();
      throw new Error("Session expired. Please login again.");
    }

    if (res.status === 401) {
      redirectToLoginOnce();
      throw new Error("Session expired. Please login again.");
    }

    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      let message = `Request failed ${res.status}`;
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { message?: string; error?: string };
          message = parsed.message || parsed.error || message;
        } catch {
          message = raw;
        }
      }
      throw new Error(message);
    }

    return res;
  }

  function extractFileNameFromDisposition(disposition?: string | null) {
    if (!disposition) return null;
    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);
    const basicMatch = disposition.match(/filename=\"?([^\";]+)\"?/i);
    return basicMatch?.[1] || null;
  }

  function triggerBlobDownload(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadGeneratedArtifact(
    entityType: "RENDER_BATCH" | "PRINT_JOB",
    entityId: string,
    fallbackFileName: string
  ) {
    const signed = await apiRequest<{ token: string }>(
      `/platform/security/generated-artifacts/signed-url?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`
    );
    const res = await apiFetchRaw(`/platform/security/generated-artifacts/${encodeURIComponent(signed.token)}`);
    const blob = await res.blob();
    const fileName = extractFileNameFromDisposition(res.headers.get("Content-Disposition")) || fallbackFileName;
    triggerBlobDownload(blob, fileName);
    return fileName;
  }

  function applyTheme(next: ThemeMode, options?: { persist?: boolean; withTransition?: boolean }) {
    setTheme(next);
    applyThemePreference(next, options);
  }

  function clearMessage() {
    window.setTimeout(() => {
      setError("");
      setSuccess("");
    }, 2600);
  }

  function buildOverviewQuery(extra?: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    p.set("start", filters.start);
    p.set("end", filters.end);
    if (filters.salesOwnerId) p.set("salesOwnerId", filters.salesOwnerId);
    if (filters.region) p.set("region", filters.region);
    if (filters.status) p.set("status", filters.status);
    Object.entries(extra || {}).forEach(([k, v]) => {
      if (v) p.set(k, v);
    });
    return p.toString();
  }

  function buildReportQuery() {
    const p = new URLSearchParams();
    p.set("dateFrom", filters.start);
    p.set("dateTo", filters.end);
    return p.toString();
  }

  function buildRetentionQuery() {
    const p = new URLSearchParams();
    if (retentionForm.otpRetentionHours) p.set("otpRetentionHours", retentionForm.otpRetentionHours);
    if (retentionForm.resetTokenRetentionHours) {
      p.set("resetTokenRetentionHours", retentionForm.resetTokenRetentionHours);
    }
    if (retentionForm.sessionRetentionDays) p.set("sessionRetentionDays", retentionForm.sessionRetentionDays);
    if (retentionForm.artifactRetentionDays) p.set("artifactRetentionDays", retentionForm.artifactRetentionDays);
    return p.toString();
  }

  async function loadOverview() {
    setLoading((prev) => ({ ...prev, overview: true }));
    setError("");
    try {
      const q = buildOverviewQuery();
      const [kpiRes, subRes, appRes, revRes, perfRes] = await Promise.all([
        apiRequest<OverviewKpis>(`/admin/overview/kpis?${q}`),
        apiRequest<{ points: TimePoint[] }>(
          `/admin/overview/timeseries?${buildOverviewQuery({ metric: "submissions", granularity: "daily" })}`
        ),
        apiRequest<{ points: TimePoint[] }>(
          `/admin/overview/timeseries?${buildOverviewQuery({ metric: "approvals", granularity: "daily" })}`
        ),
        apiRequest<{ points: TimePoint[] }>(
          `/admin/overview/timeseries?${buildOverviewQuery({ metric: "revenue", granularity: "daily" })}`
        ),
        apiRequest<{ rows: SalesRow[] }>(
          `/admin/overview/sales-performance?${buildOverviewQuery({ limit: "10" })}`
        )
      ]);
      setKpis(kpiRes);
      setSubmissions(subRes.points || []);
      setApprovals(appRes.points || []);
      setRevenue(revRes.points || []);
      setSalesRows(perfRes.rows || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load overview");
      clearMessage();
    } finally {
      setLoading((prev) => ({ ...prev, overview: false }));
    }
  }

  async function loadSchools() {
    setLoading((prev) => ({ ...prev, schools: true }));
    try {
      setSchools(await apiRequest<SchoolRow[]>("/schools"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load schools");
      clearMessage();
    } finally {
      setLoading((prev) => ({ ...prev, schools: false }));
    }
  }

  async function loadUsers() {
    setLoading((prev) => ({ ...prev, users: true }));
    try {
      const roleParam = userRoleFilter ? `?role=${userRoleFilter}` : "";
      setUsers(await apiRequest<UserRow[]>(`/admin/users${roleParam}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
      clearMessage();
    } finally {
      setLoading((prev) => ({ ...prev, users: false }));
    }
  }

  async function loadReports() {
    setLoading((prev) => ({ ...prev, reports: true }));
    try {
      setReports(await apiRequest<ReportsResponse>(`/admin/reports/schools?${buildReportQuery()}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reports");
      clearMessage();
    } finally {
      setLoading((prev) => ({ ...prev, reports: false }));
    }
  }

  async function loadPrintJobs() {
    setLoading((prev) => ({ ...prev, printOps: true }));
    try {
      setPrintJobs(await apiRequest<PrintJobRow[]>("/admin/print-jobs"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load print jobs");
      clearMessage();
    } finally {
      setLoading((prev) => ({ ...prev, printOps: false }));
    }
  }

  async function loadRetentionSummary(options?: { announce?: boolean }) {
    if (!canViewRetention) return;
    setLoading((prev) => ({ ...prev, retentionSummary: true }));
    try {
      const query = buildRetentionQuery();
      const response = await apiRequest<RetentionSummaryResponse>(
        `/platform/security/retention/summary${query ? `?${query}` : ""}`
      );
      setRetentionSummary(response);
      setRetentionForm({
        otpRetentionHours: String(response.policy.otpRetentionHours),
        resetTokenRetentionHours: String(response.policy.resetTokenRetentionHours),
        sessionRetentionDays: String(response.policy.sessionRetentionDays),
        artifactRetentionDays: String(response.policy.artifactRetentionDays)
      });
      if (options?.announce) {
        setSuccess("Retention summary refreshed.");
        clearMessage();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load retention summary");
      clearMessage();
    } finally {
      setLoading((prev) => ({ ...prev, retentionSummary: false }));
    }
  }

  async function runRetentionPurge(dryRun: boolean) {
    if (!canViewRetention) return;
    setLoading((prev) => ({ ...prev, retentionPurge: true }));
    try {
      const response = await apiRequest<RetentionPurgeResponse>("/platform/security/retention/purge", {
        method: "POST",
        body: JSON.stringify({
          dryRun,
          otpRetentionHours: Number(retentionForm.otpRetentionHours),
          resetTokenRetentionHours: Number(retentionForm.resetTokenRetentionHours),
          sessionRetentionDays: Number(retentionForm.sessionRetentionDays),
          artifactRetentionDays: Number(retentionForm.artifactRetentionDays)
        })
      });
      setRetentionResult(response);
      setRetentionForm({
        otpRetentionHours: String(response.policy.otpRetentionHours),
        resetTokenRetentionHours: String(response.policy.resetTokenRetentionHours),
        sessionRetentionDays: String(response.policy.sessionRetentionDays),
        artifactRetentionDays: String(response.policy.artifactRetentionDays)
      });
      if (dryRun) {
        setSuccess("Retention dry run completed.");
      } else {
        setSuccess("Retention purge executed and audited.");
      }
      clearMessage();
      await Promise.all([loadRetentionSummary(), canViewSecurityOperations ? loadSecurityEvents() : Promise.resolve()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run retention purge");
      clearMessage();
    } finally {
      setLoading((prev) => ({ ...prev, retentionPurge: false }));
    }
  }

  async function loadAuthAnomalies(limit = 60) {
    if (!canViewSecurityOperations) return;
    setLoading((prev) => ({ ...prev, authAnomalies: true }));
    try {
      const response = await apiRequest<AuthAnomaliesResponse>(
        `/platform/security/auth-anomalies?limit=${encodeURIComponent(String(limit))}`
      );
      setAuthAnomalies(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load auth anomalies");
      clearMessage();
    } finally {
      setLoading((prev) => ({ ...prev, authAnomalies: false }));
    }
  }

  async function loadSecurityEvents(limit = 60) {
    if (!canViewSecurityOperations) return;
    setLoading((prev) => ({ ...prev, securityEvents: true }));
    try {
      const response = await apiRequest<SecurityEventFeedResponse>(
        `/platform/security/event-feed?limit=${encodeURIComponent(String(limit))}`
      );
      setSecurityEvents(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load security event feed");
      clearMessage();
    } finally {
      setLoading((prev) => ({ ...prev, securityEvents: false }));
    }
  }

  async function loadMaskPolicies(schoolId: string) {
    if (!canViewSecurityOperations || !schoolId) return;
    setLoading((prev) => ({ ...prev, maskPolicies: true }));
    try {
      const response = await apiRequest<MaskPolicyRow[]>(
        `/platform/security/mask-policies?schoolId=${encodeURIComponent(schoolId)}`
      );
      setMaskPolicies(response || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load mask policies");
      clearMessage();
    } finally {
      setLoading((prev) => ({ ...prev, maskPolicies: false }));
    }
  }

  async function submitMaskPolicy() {
    if (!canManageMaskPolicies) return;
    const schoolId = maskPolicyForm.schoolId || securitySchoolId;
    if (!schoolId) {
      setError("Select a school before saving a mask policy.");
      clearMessage();
      return;
    }
    if (!maskPolicyForm.fieldKey.trim()) {
      setError("Field key is required.");
      clearMessage();
      return;
    }
    const rolesAllowed = maskPolicyForm.rolesAllowed
      .split(",")
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);
    if (!rolesAllowed.length) {
      setError("Add at least one allowed role.");
      clearMessage();
      return;
    }

    setLoading((prev) => ({ ...prev, upsertMaskPolicy: true }));
    try {
      await apiRequest<MaskPolicyRow>("/platform/security/mask-policies", {
        method: "POST",
        body: JSON.stringify({
          schoolId,
          fieldKey: maskPolicyForm.fieldKey.trim(),
          rolesAllowed,
          maskStrategy: maskPolicyForm.maskStrategy.trim().toUpperCase(),
          isActive: maskPolicyForm.isActive
        })
      });
      setSuccess("Mask policy saved and audited.");
      clearMessage();
      await loadMaskPolicies(schoolId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save mask policy");
      clearMessage();
    } finally {
      setLoading((prev) => ({ ...prev, upsertMaskPolicy: false }));
    }
  }

  async function revokeSelectedUserSessions() {
    if (!canRevokeSessions) return;
    if (!revokeUserId) {
      setError("Choose a user before revoking sessions.");
      clearMessage();
      return;
    }
    setLoading((prev) => ({ ...prev, revokeSessions: true }));
    try {
      const result = await apiRequest<{ userId: string; revokedSessions: number }>(
        "/platform/security/revoke-sessions",
        {
          method: "POST",
          body: JSON.stringify({
            userId: revokeUserId,
            revokeMfa
          })
        }
      );
      setSuccess(`Revoked ${fmtInt(result.revokedSessions)} active sessions.`);
      clearMessage();
      await Promise.all([loadAuthAnomalies(), loadSecurityEvents(), loadAuditLogs(1)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revoke sessions");
      clearMessage();
    } finally {
      setLoading((prev) => ({ ...prev, revokeSessions: false }));
    }
  }

  async function loadTemplates(schoolId: string) {
    setLoading((prev) => ({ ...prev, templates: true }));
    try {
      const rows = await apiRequest<TemplateRow[]>(
        `/admin/schools/${encodeURIComponent(schoolId)}/templates`
      );
      setTemplates(rows || []);
      const nextTemplateId = selectedTemplateId || rows?.[0]?.id || "";
      setSelectedTemplateId(nextTemplateId);
      setAssignmentForm((prev) => ({ ...prev, templateId: prev.templateId || nextTemplateId }));
      setRenderBatchForm((prev) => ({ ...prev, templateId: prev.templateId || nextTemplateId }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load templates");
      clearMessage();
    } finally {
      setLoading((prev) => ({ ...prev, templates: false }));
    }
  }

  async function loadTemplateAssignments(schoolId: string) {
    setLoading((prev) => ({ ...prev, templateAssignments: true }));
    try {
      setTemplateAssignments(
        await apiRequest<TemplateAssignmentRow[]>(
          `/admin/schools/${encodeURIComponent(schoolId)}/template-assignments`
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load template assignments");
      clearMessage();
    } finally {
      setLoading((prev) => ({ ...prev, templateAssignments: false }));
    }
  }

  async function loadRenderBatches(schoolId: string) {
    setLoading((prev) => ({ ...prev, renderBatches: true }));
    try {
      setRenderBatches(
        await apiRequest<RenderBatchRow[]>(
          `/admin/schools/${encodeURIComponent(schoolId)}/render-batches`
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load render batches");
      clearMessage();
    } finally {
      setLoading((prev) => ({ ...prev, renderBatches: false }));
    }
  }

  async function loadTemplateTokens() {
    try {
      const rows = await apiRequest<TemplateToken[]>("/admin/template-tokens");
      setTemplateTokens(rows || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load template tokens");
      clearMessage();
    }
  }

  async function loadTemplateDetail(templateId: string) {
    try {
      const detail = await apiRequest<TemplateDetail>(`/admin/templates/${encodeURIComponent(templateId)}`);
      setTemplateDetail(detail);
      const nextFront = parseStudioLayout(detail.frontLayoutJson);
      const nextBack = parseStudioLayout(detail.backLayoutJson);
      setStudioFrontLayout(nextFront);
      setStudioBackLayout(nextBack);
      if (detail.cardWidthMm && detail.cardHeightMm) {
        setStudioWidthMm(String(detail.cardWidthMm));
        setStudioHeightMm(String(detail.cardHeightMm));
        const matched = CARD_LAYOUT_PRESETS.find(
          (row) => row.width === detail.cardWidthMm && row.height === detail.cardHeightMm
        );
        if (matched) setStudioLayoutPreset(matched.key);
      }
      setStudioProjectType(nextBack.elements.length ? "BOTH_SIDED" : "SINGLE_SIDED");
      setStudioSide("front");
      setStudioSelectedElementId(nextFront.elements[0]?.id || "");
      setStudioPreview(null);
      setStudioWarnings([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load template details");
      clearMessage();
    }
  }

  function withStudioLayout(side: "front" | "back", updater: (prev: StudioLayout) => StudioLayout) {
    if (side === "front") {
      setStudioFrontLayout((prev) => updater(prev));
      return;
    }
    setStudioBackLayout((prev) => updater(prev));
  }

  function resizeStudioLayouts(nextWidth: number, nextHeight: number) {
    const normalize = (layout: StudioLayout): StudioLayout => ({
      ...layout,
      width: nextWidth,
      height: nextHeight,
      elements: layout.elements.map((element) => {
        const width = Math.max(8, Math.min(element.width, nextWidth));
        const height = Math.max(2, Math.min(element.height, nextHeight));
        return {
          ...element,
          width,
          height,
          x: Math.max(0, Math.min(element.x, nextWidth - width)),
          y: Math.max(0, Math.min(element.y, nextHeight - height))
        };
      })
    });
    setStudioFrontLayout((prev) => normalize(prev));
    setStudioBackLayout((prev) => normalize(prev));
  }

  function applyStudioSize(widthMmRaw?: string, heightMmRaw?: string) {
    const widthMm = Number(widthMmRaw ?? studioWidthMm);
    const heightMm = Number(heightMmRaw ?? studioHeightMm);
    if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm) || widthMm <= 0 || heightMm <= 0) {
      setError("Width/Height must be valid numbers");
      clearMessage();
      return;
    }
    const next = mmToCanvasSize(widthMm, heightMm);
    resizeStudioLayouts(next.width, next.height);
    setStudioWidthMm(String(widthMm));
    setStudioHeightMm(String(heightMm));
  }

  function applyLayoutPreset(presetKey: string) {
    setStudioLayoutPreset(presetKey);
    const preset = CARD_LAYOUT_PRESETS.find((row) => row.key === presetKey);
    if (!preset) return;
    const next = mmToCanvasSize(preset.width, preset.height);
    setStudioWidthMm(String(preset.width));
    setStudioHeightMm(String(preset.height));
    resizeStudioLayouts(next.width, next.height);
  }

  function applyQuickAlignment(mode: "max-width" | "h-center" | "v-center") {
    if (!studioSelectedElement) return;
    if (mode === "max-width") {
      updateStudioElement(studioSelectedElement.id, { x: 16, width: Math.max(studioLayout.width - 32, 16) });
      return;
    }
    if (mode === "h-center") {
      updateStudioElement(studioSelectedElement.id, {
        x: Math.round((studioLayout.width - studioSelectedElement.width) / 2)
      });
      return;
    }
    updateStudioElement(studioSelectedElement.id, {
      y: Math.round((studioLayout.height - studioSelectedElement.height) / 2)
    });
  }

  function updateStudioElement(elementId: string, patch: Partial<StudioElement>) {
    withStudioLayout(studioSide, (prev) => ({
      ...prev,
      elements: prev.elements.map((element) => {
        if (element.id !== elementId) return element;
        const nextWidth = Math.max(8, Number(patch.width ?? element.width));
        const nextHeight = Math.max(2, Number(patch.height ?? element.height));
        const rawX = Number(patch.x ?? element.x);
        const rawY = Number(patch.y ?? element.y);
        return {
          ...element,
          ...patch,
          width: nextWidth,
          height: nextHeight,
          x: Math.max(0, Math.min(rawX, prev.width - nextWidth)),
          y: Math.max(0, Math.min(rawY, prev.height - nextHeight))
        };
      })
    }));
  }

  function addStudioElement(type: StudioElementType) {
    const seed = Date.now();
    const defaults: Record<StudioElementType, Partial<StudioElement>> = {
      text: {
        width: 220,
        height: 36,
        text: "{{student_name}}",
        color: "#0f172a",
        background: "transparent",
        borderColor: "transparent",
        borderRadius: 0,
        fontSize: 15,
        fontWeight: 600,
        textAlign: "left"
      },
      photo: {
        width: 128,
        height: 164,
        background: "#e2e8f0",
        borderColor: "#475569",
        borderRadius: 10
      },
      qr: {
        width: 74,
        height: 74,
        background: "#f8fafc",
        borderColor: "#475569",
        borderRadius: 8
      },
      barcode: {
        width: 156,
        height: 52,
        background: "#f8fafc",
        borderColor: "#475569",
        borderRadius: 6
      },
      shape: {
        width: 160,
        height: 70,
        background: "rgba(58,141,255,0.18)",
        borderColor: "rgba(58,141,255,0.72)",
        borderRadius: 12
      },
      line: {
        width: 220,
        height: 2,
        background: "#334155",
        borderColor: "transparent",
        borderRadius: 2
      }
    };
    const current = studioSide === "front" ? studioFrontLayout : studioBackLayout;
    const offset = current.elements.length * 8;
    const item: StudioElement = {
      id: `${type}-${seed}`,
      type,
      x: Math.min(30 + offset, current.width - 120),
      y: Math.min(26 + offset, current.height - 56),
      width: defaults[type].width || 120,
      height: defaults[type].height || 40,
      text: defaults[type].text,
      token: defaults[type].token,
      color: defaults[type].color || "#0f172a",
      background: defaults[type].background || "transparent",
      borderColor: defaults[type].borderColor || "transparent",
      borderRadius: defaults[type].borderRadius || 0,
      fontSize: defaults[type].fontSize || 14,
      fontWeight: defaults[type].fontWeight || 500,
      textAlign: defaults[type].textAlign || "left",
      locked: false
    };
    withStudioLayout(studioSide, (prev) => ({ ...prev, elements: [...prev.elements, item] }));
    setStudioSelectedElementId(item.id);
  }

  function duplicateStudioElement(elementId: string) {
    const source = studioLayout.elements.find((element) => element.id === elementId);
    if (!source) return;
    const duplicate: StudioElement = {
      ...source,
      id: `${source.type}-${Date.now()}`,
      x: Math.max(0, Math.min(source.x + 14, studioLayout.width - source.width)),
      y: Math.max(0, Math.min(source.y + 14, studioLayout.height - source.height)),
      locked: false
    };
    withStudioLayout(studioSide, (prev) => ({ ...prev, elements: [...prev.elements, duplicate] }));
    setStudioSelectedElementId(duplicate.id);
  }

  function removeStudioElement(elementId: string) {
    withStudioLayout(studioSide, (prev) => ({
      ...prev,
      elements: prev.elements.filter((element) => element.id !== elementId)
    }));
    setStudioSelectedElementId("");
  }

  function insertTokenIntoSelected(token: string) {
    if (!studioSelectedElement) return;
    if (studioSelectedElement.type !== "text") return;
    const hasText = typeof studioSelectedElement.text === "string" ? studioSelectedElement.text : "";
    const next = hasText ? `${hasText} {{${token}}}` : `{{${token}}}`;
    updateStudioElement(studioSelectedElement.id, { text: next });
  }

  async function saveStudioTemplate() {
    if (!selectedTemplateId) {
      setError("Select template first");
      clearMessage();
      return;
    }
    setStudioSaving(true);
    try {
      const mappingJson = buildMappingFromStudio(studioFrontLayout, studioBackLayout);
      const res = await apiRequest<{
        validation?: { warnings?: string[] };
        rebind?: { updatedProofs: number; templateVersion: number; warnings?: string[] };
      }>(`/admin/templates/${encodeURIComponent(selectedTemplateId)}/mapping`, {
        method: "PATCH",
        body: JSON.stringify({
          mappingJson,
          frontLayoutJson: studioFrontLayout,
          backLayoutJson: studioBackLayout
        })
      });
      const warnings = [
        ...(res.validation?.warnings || []),
        ...(res.rebind?.warnings || [])
      ].filter(Boolean);
      setStudioWarnings([...new Set(warnings)]);
      setSuccess(
        `Template saved. Version ${res.rebind?.templateVersion || "updated"} â€¢ Rebound proofs: ${
          res.rebind?.updatedProofs ?? 0
        }`
      );
      if (templateSchoolId) {
        await loadTemplates(templateSchoolId);
      }
      await loadTemplateDetail(selectedTemplateId);
      clearMessage();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save template");
      clearMessage();
    } finally {
      setStudioSaving(false);
    }
  }

  async function renderStudioTemplatePreview() {
    if (!selectedTemplateId) {
      setError("Select template first");
      clearMessage();
      return;
    }
    try {
      const res = await apiRequest<{
        preview: Record<string, unknown>;
        validation?: { warnings?: string[] };
      }>(`/admin/templates/${encodeURIComponent(selectedTemplateId)}/render-preview`, {
        method: "POST",
        body: JSON.stringify({
          side: "both",
          includeWarnings: true
        })
      });
      setStudioPreview(res.preview || null);
      setStudioWarnings(res.validation?.warnings || []);
      setSuccess("Live preview refreshed.");
      clearMessage();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to render preview");
      clearMessage();
    }
  }

  async function submitTemplate() {
    if (!templateSchoolId) {
      setError("Select school for template");
      clearMessage();
      return;
    }
    setLoading((prev) => ({ ...prev, createTemplate: true }));
    try {
      const fallbackFront = createDefaultStudioLayout();
      const fallbackBack = parseStudioLayout(studioBackLayout);
      const parsedMapping = buildMappingFromStudio(fallbackFront, fallbackBack);
      const cardWidthMm = Number(studioWidthMm) || 86;
      const cardHeightMm = Number(studioHeightMm) || 54;
      const created = await apiRequest<TemplateDetail>(`/admin/schools/${encodeURIComponent(templateSchoolId)}/templates`, {
        method: "POST",
        body: JSON.stringify({
          name: templateForm.name.trim(),
          templateCode: templateForm.templateCode.trim() || undefined,
          cardType: templateForm.cardType,
          institutionType: templateForm.institutionType,
          orientation: cardWidthMm >= cardHeightMm ? "LANDSCAPE" : "PORTRAIT",
          cardWidthMm,
          cardHeightMm,
          isActive: templateForm.isActive,
          isDefault: templateForm.isDefault,
          status: templateForm.isActive ? "PUBLISHED" : "DRAFT",
          notes: templateForm.notes.trim() || undefined,
          mappingJson: parsedMapping,
          frontLayoutJson: fallbackFront,
          backLayoutJson: fallbackBack
        })
      });
      setSuccess("Template created.");
      setTemplateForm((prev) => ({ ...prev, name: "", templateCode: "", notes: "" }));
      if (created?.id) setSelectedTemplateId(created.id);
      await Promise.all([
        loadTemplates(templateSchoolId),
        loadTemplateAssignments(templateSchoolId),
        loadRenderBatches(templateSchoolId)
      ]);
      clearMessage();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create template");
      clearMessage();
    } finally {
      setLoading((prev) => ({ ...prev, createTemplate: false }));
    }
  }

  async function changeTemplateStatus(templateId: string, status: "PUBLISHED" | "ARCHIVED" | "DRAFT") {
    try {
      await apiRequest(`/admin/templates/${templateId}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          deactivateOthers: true
        })
      });
      setSuccess(`Template moved to ${status}.`);
      if (templateSchoolId) await loadTemplates(templateSchoolId);
      clearMessage();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update template status");
      clearMessage();
    }
  }

  async function duplicateTemplateAction(templateId: string) {
    try {
      await apiRequest(`/admin/templates/${templateId}/duplicate`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setSuccess("Template duplicated.");
      if (templateSchoolId) await loadTemplates(templateSchoolId);
      clearMessage();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to duplicate template");
      clearMessage();
    }
  }

  async function submitTemplateAssignment() {
    if (!templateSchoolId) return;
    setLoading((prev) => ({ ...prev, upsertTemplateAssignment: true }));
    try {
      await apiRequest(`/admin/schools/${encodeURIComponent(templateSchoolId)}/template-assignments`, {
        method: "POST",
        body: JSON.stringify({
          templateId: assignmentForm.templateId || selectedTemplateId,
          scope: assignmentForm.scope,
          cardType: assignmentForm.cardType,
          className: assignmentForm.className || undefined,
          section: assignmentForm.section || undefined,
          intakeLinkId: assignmentForm.intakeLinkId || undefined,
          isDefault: assignmentForm.isDefault,
          isActive: assignmentForm.isActive,
          priority: Number(assignmentForm.priority || "100"),
          notes: assignmentForm.notes || undefined
        })
      });
      setSuccess("Template assignment saved.");
      await loadTemplateAssignments(templateSchoolId);
      clearMessage();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save template assignment");
      clearMessage();
    } finally {
      setLoading((prev) => ({ ...prev, upsertTemplateAssignment: false }));
    }
  }

  async function triggerRenderBatch() {
    if (!renderBatchForm.templateId) {
      setError("Select template for render batch");
      clearMessage();
      return;
    }
    setLoading((prev) => ({ ...prev, createRenderBatch: true }));
    try {
      await apiRequest(`/admin/templates/${encodeURIComponent(renderBatchForm.templateId)}/render-batches`, {
        method: "POST",
        body: JSON.stringify({
          className: renderBatchForm.className || undefined,
          section: renderBatchForm.section || undefined,
          studentStatus: renderBatchForm.studentStatus || undefined,
          onlyApproved: renderBatchForm.onlyApproved,
          outputFormat: renderBatchForm.outputFormat,
          pageSize: renderBatchForm.pageSize,
          customPageMm: renderBatchForm.customPageMm || undefined,
          grid: renderBatchForm.grid,
          sideMode: renderBatchForm.sideMode,
          skipInvalid: true
        })
      });
      setSuccess("Render batch created.");
      if (templateSchoolId) await loadRenderBatches(templateSchoolId);
      clearMessage();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create render batch");
      clearMessage();
    } finally {
      setLoading((prev) => ({ ...prev, createRenderBatch: false }));
    }
  }

  async function exportRenderBatch(batchId: string, format: "PDF" | "JSON") {
    try {
      const res = await apiRequest<{ fileName: string; artifactUrl: string; byteSize: number }>(
        `/admin/render-batches/${encodeURIComponent(batchId)}/export`,
        {
          method: "POST",
          body: JSON.stringify({
            format,
            pageSize: renderBatchForm.pageSize,
            customPageMm: renderBatchForm.customPageMm || undefined,
            grid: renderBatchForm.grid,
            sideMode: renderBatchForm.sideMode
          })
        }
      );
      const downloaded = await downloadGeneratedArtifact("RENDER_BATCH", batchId, res.fileName);
      setSuccess(`Batch exported and downloaded: ${downloaded}`);
      if (templateSchoolId) await loadRenderBatches(templateSchoolId);
      clearMessage();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to export render batch");
      clearMessage();
    }
  }

  async function generatePrintArtifact(printJobId: string, format: "PDF" | "JSON" | "CSV" = "PDF") {
    setActivePrintJobActionId(printJobId);
    try {
      const res = await apiRequest<{ fileName: string }>(`/admin/print-jobs/${encodeURIComponent(printJobId)}/generate-artifact`, {
        method: "POST",
        body: JSON.stringify({
          format,
          pageSize: renderBatchForm.pageSize,
          customPageMm: renderBatchForm.customPageMm || undefined,
          grid: renderBatchForm.grid,
          sideMode: renderBatchForm.sideMode
        })
      });
      const downloaded = await downloadGeneratedArtifact("PRINT_JOB", printJobId, res.fileName);
      setSuccess(`Print artifact generated and downloaded: ${downloaded}`);
      await loadPrintJobs();
      clearMessage();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate print artifact");
      clearMessage();
    } finally {
      setActivePrintJobActionId(null);
    }
  }

  async function downloadPrintArtifact(printJobId: string) {
    setActivePrintJobActionId(printJobId);
    try {
      const downloaded = await downloadGeneratedArtifact("PRINT_JOB", printJobId, `${printJobId}.pdf`);
      setSuccess(`Print artifact downloaded: ${downloaded}`);
      clearMessage();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to download print artifact");
      clearMessage();
    } finally {
      setActivePrintJobActionId(null);
    }
  }

  async function exportPrintJobCsv(printJobId: string) {
    setActivePrintJobActionId(printJobId);
    try {
      const res = await apiFetchRaw(`/admin/print-jobs/${encodeURIComponent(printJobId)}/export.csv`);
      const blob = await res.blob();
      const fileName =
        extractFileNameFromDisposition(res.headers.get("Content-Disposition")) || `print-job-${printJobId}.csv`;
      triggerBlobDownload(blob, fileName);
      setSuccess(`Print CSV downloaded: ${fileName}`);
      clearMessage();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to export print job CSV");
      clearMessage();
    } finally {
      setActivePrintJobActionId(null);
    }
  }

  async function loadInvoices() {
    setLoading((prev) => ({ ...prev, invoices: true }));
    try {
      setInvoices(await apiRequest<InvoiceRow[]>("/billing/invoices"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load invoices");
      clearMessage();
    } finally {
      setLoading((prev) => ({ ...prev, invoices: false }));
    }
  }

  async function loadBillingSummary() {
    setLoading((prev) => ({ ...prev, billingSummary: true }));
    try {
      const q = new URLSearchParams();
      q.set("start", filters.start);
      q.set("end", filters.end);
      setBillingSummary(await apiRequest<BillingReconciliation>(`/billing/reconciliation?${q.toString()}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load billing summary");
      clearMessage();
    } finally {
      setLoading((prev) => ({ ...prev, billingSummary: false }));
    }
  }

  async function loadAuditLogs(page: number) {
    setLoading((prev) => ({ ...prev, audit: true }));
    try {
      const q = new URLSearchParams();
      q.set("page", String(page));
      q.set("pageSize", String(auditPageSize));
      if (auditEntityType.trim()) q.set("entityType", auditEntityType.trim());
      if (auditActorId.trim()) q.set("actorUserId", auditActorId.trim());
      const res = await apiRequest<{ total: number; rows: AuditRow[] }>(`/admin/audit-logs?${q.toString()}`);
      setAuditRows(res.rows || []);
      setAuditTotal(res.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit logs");
      clearMessage();
    } finally {
      setLoading((prev) => ({ ...prev, audit: false }));
    }
  }

  async function openDrilldown(metric: MetricKey, date: string) {
    setDrilldown({ open: true, metric, date, rows: [], loading: true, error: "" });
    try {
      const res = await apiRequest<{ rows: DrillRow[] }>(
        `/admin/overview/drilldown?${buildOverviewQuery({ metric, date })}`
      );
      setDrilldown({ open: true, metric, date, rows: res.rows || [], loading: false, error: "" });
    } catch (e) {
      setDrilldown({
        open: true,
        metric,
        date,
        rows: [],
        loading: false,
        error: e instanceof Error ? e.message : "Failed to load drilldown"
      });
    }
  }

  async function submitSchool() {
    setLoading((prev) => ({ ...prev, createSchool: true }));
    setError("");
    try {
      const payload = {
        name: schoolForm.name.trim(),
        code: schoolForm.code.trim() || undefined,
        email: schoolForm.email.trim().toLowerCase(),
        phone: schoolForm.phone.trim() || undefined,
        city: schoolForm.city.trim() || undefined,
        state: schoolForm.state.trim() || undefined,
        principalName: schoolForm.principalName.trim() || undefined,
        principalEmail: schoolForm.principalEmail.trim() || undefined,
        principalPhone: schoolForm.principalPhone.trim() || undefined,
        status: schoolForm.status,
        salesOwnerId: schoolForm.salesOwnerId || undefined,
        adminEmail: schoolForm.adminEmail.trim() || undefined,
        adminPassword: schoolForm.adminPassword || undefined
      };
      const created = await apiRequest<SchoolRow & { trackingId?: string }>("/schools", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setSuccess(`School created successfully. Tracking ID: ${created.trackingId || created.code}`);
      setSchoolForm({
        name: "",
        code: "",
        email: "",
        phone: "",
        city: "",
        state: "",
        principalName: "",
        principalEmail: "",
        principalPhone: "",
        status: "ACTIVE",
        salesOwnerId: "",
        adminEmail: "",
        adminPassword: ""
      });
      await loadSchools();
      clearMessage();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create school");
      clearMessage();
    } finally {
      setLoading((prev) => ({ ...prev, createSchool: false }));
    }
  }

  async function submitUser() {
    setLoading((prev) => ({ ...prev, createUser: true }));
    setError("");
    try {
      await apiRequest("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: userForm.email.trim().toLowerCase(),
          password: userForm.password,
          role: userForm.role,
          phone: userForm.phone || undefined
        })
      });
      setSuccess("User created successfully.");
      setUserForm({ email: "", password: "", role: "SALES_PERSON", phone: "" });
      await loadUsers();
      clearMessage();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create user");
      clearMessage();
    } finally {
      setLoading((prev) => ({ ...prev, createUser: false }));
    }
  }

  async function deleteUser(userId: string) {
    try {
      await apiRequest(`/admin/users/${userId}`, { method: "DELETE" });
      setSuccess("User removed.");
      await loadUsers();
      clearMessage();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove user");
      clearMessage();
    }
  }

  async function submitInvoice() {
    setLoading((prev) => ({ ...prev, createInvoice: true }));
    setError("");
    try {
      await apiRequest("/billing/invoices", {
        method: "POST",
        body: JSON.stringify({
          schoolId: invoiceForm.schoolId,
          amount: Number(invoiceForm.amount),
          taxPercent: invoiceForm.taxPercent ? Number(invoiceForm.taxPercent) : undefined,
          dueAt: invoiceForm.dueAt,
          notes: invoiceForm.notes || undefined
        })
      });
      setSuccess("Invoice created.");
      setInvoiceForm({ schoolId: "", amount: "", taxPercent: "18", dueAt: "", notes: "" });
      await loadInvoices();
      await loadBillingSummary();
      clearMessage();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create invoice");
      clearMessage();
    } finally {
      setLoading((prev) => ({ ...prev, createInvoice: false }));
    }
  }

  async function dispatchToPrint() {
    setLoading((prev) => ({ ...prev, dispatch: true }));
    setError("");
    try {
      const ids = dispatchForm.studentIds
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      if (!ids.length) {
        throw new Error("Enter at least one student ID");
      }
      await apiRequest("/admin/print-jobs/dispatch", {
        method: "POST",
        body: JSON.stringify({
          studentIds: ids,
          assignedToId: dispatchForm.assignedToId || undefined,
          notes: dispatchForm.notes || undefined
        })
      });
      setSuccess("Print job dispatched.");
      setDispatchForm({ studentIds: "", assignedToId: "", notes: "" });
      await loadPrintJobs();
      clearMessage();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to dispatch print job");
      clearMessage();
    } finally {
      setLoading((prev) => ({ ...prev, dispatch: false }));
    }
  }

  async function exportReportCsv() {
    try {
      const res = await apiFetchRaw(`/admin/reports/schools.csv?${buildReportQuery()}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `school-report-${filters.start}-to-${filters.end}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
      clearMessage();
    }
  }

  async function openSchoolDetail(schoolId: string) {
    router.push(`/dashboard/schools/${schoolId}`);
  }

  async function loadDetailIntakeLinks(schoolId: string) {
    setDetailIntakeLoading(true);
    try {
      const rows = await apiRequest<IntakeLinkRow[]>(`/intake-links?schoolId=${encodeURIComponent(schoolId)}`);
      setDetailIntakeLinks(rows || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load intake links");
      clearMessage();
    } finally {
      setDetailIntakeLoading(false);
    }
  }

  async function loadDetailStudents(
    schoolId: string,
    page = 1,
    opts?: { q?: string; status?: StudentStatus | "" }
  ) {
    setDetailStudentsLoading(true);
    try {
      const q = new URLSearchParams();
      q.set("page", String(page));
      q.set("pageSize", "20");
      const searchText = opts?.q !== undefined ? opts.q : detailStudentQuery;
      const statusValue = opts?.status !== undefined ? opts.status : detailStudentStatus;
      if (searchText?.trim()) q.set("q", searchText.trim());
      if (statusValue) q.set("status", statusValue);
      const res = await apiRequest<SchoolStudentListResponse>(
        `/admin/schools/${encodeURIComponent(schoolId)}/students?${q.toString()}`
      );
      setDetailStudents(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load school students");
      clearMessage();
    } finally {
      setDetailStudentsLoading(false);
    }
  }

  async function createDetailIntakeLink() {
    if (!detailData?.school.id) return;
    setDetailCreateLinkLoading(true);
    try {
      const created = await apiRequest<IntakeLinkRow>(
        `/schools/${encodeURIComponent(detailData.school.id)}/intake-links`,
        {
          method: "POST",
          body: JSON.stringify({
            className: detailIntakeForm.className || "ALL",
            section: detailIntakeForm.section || "ALL",
            maxStudentsPerParent: Number(detailIntakeForm.maxStudentsPerParent || "3"),
            photoBgPreference: detailIntakeForm.photoBgPreference || "WHITE",
            expiresAt: detailIntakeForm.expiresAt || undefined
          })
        }
      );
      setSuccess("Intake link created.");
      setDetailIntakeLinks((prev) => [created, ...prev]);
      setDetailIntakeForm((prev) => ({ ...prev, expiresAt: "" }));
      clearMessage();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create intake link");
      clearMessage();
    } finally {
      setDetailCreateLinkLoading(false);
    }
  }

  async function saveSchoolDetail() {
    if (!detailData || !detailDraft) return;
    setSavingSchoolDetail(true);
    try {
      const updated = await apiRequest<SchoolRow>(`/admin/schools/${detailData.school.id}`, {
        method: "PATCH",
        body: JSON.stringify(detailDraft)
      });
      setSuccess("School updated with audit trail.");
      setSchools((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
      setDetailData((prev) =>
        prev
          ? {
              ...prev,
              school: {
                ...prev.school,
                name: detailDraft.name,
                email: detailDraft.email,
                phone: detailDraft.phone,
                city: detailDraft.city,
                state: detailDraft.state,
                status: detailDraft.status
              }
            }
          : prev
      );
      clearMessage();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update school");
      clearMessage();
    } finally {
      setSavingSchoolDetail(false);
    }
  }

  async function updateStudentStatus(studentId: string, status: StudentStatus) {
    setSavingStudentId(studentId);
    try {
      await apiRequest(`/admin/students/${studentId}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      setSuccess("Student updated with audit trail.");
      setDetailData((prev) =>
        prev
          ? {
              ...prev,
              recentStudents: prev.recentStudents.map((s) => (s.id === studentId ? { ...s, status } : s))
            }
          : prev
      );
      setDetailStudents((prev) =>
        prev
          ? {
              ...prev,
              rows: prev.rows.map((s) => (s.id === studentId ? { ...s, status } : s))
            }
          : prev
      );
      clearMessage();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update student");
      clearMessage();
    } finally {
      setSavingStudentId("");
    }
  }

  async function logout() {
    const refreshToken = localStorage.getItem("company_refresh_token");
    try {
      await fetch(`${apiBase}/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(refreshToken ? { refreshToken } : {})
      });
    } finally {
      clearLocalSession();
      router.replace("/login");
    }
  }

  if (booting) return <OrbLoader theme={theme} />;

  return (
    <main className="min-h-screen px-3 py-3 text-[var(--text-primary)] md:px-6 md:py-6">
      <div className="mx-auto grid max-w-[1860px] gap-4 lg:grid-cols-[auto_1fr]">
        <motion.aside
          animate={{ width: collapsed ? 92 : 280 }}
          className="glass sticky top-3 hidden h-[calc(100vh-1.5rem)] overflow-hidden p-3 lg:block"
        >
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {!collapsed ? (
                <BrandLogo className="h-[35px] w-auto" theme={theme} />
              ) : (
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#0F3C78] to-[#1C6ED5] text-xs font-semibold text-white">
                  S
                </div>
              )}
              {!collapsed ? <p className="text-sm font-semibold">SAVJAX ID Systems</p> : null}
            </div>
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="rounded-lg border border-[var(--line-soft)] p-1"
            >
              {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>

          <div className="space-y-1">
            {visibleModules.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setModuleKey(item.key)}
                className={`hover-glow flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
                  moduleKey === item.key
                    ? "border-[#0F3C78] bg-[linear-gradient(135deg,rgba(26,44,114,0.22),rgba(28,110,213,0.18))]"
                    : "border-[var(--line-soft)] text-[var(--text-muted)]"
                }`}
              >
                <item.icon size={15} />
                {!collapsed ? item.label : null}
              </button>
            ))}
          </div>
        </motion.aside>

        <section className="space-y-3">
          <header className="glass sticky top-3 z-20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="m-0 text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  {role.replaceAll("_", " ")} / {moduleLabel}
                </p>
                <p className="m-0 mt-1 text-2xl font-semibold">SAVJAX ID Systems</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <div className="focus-glow flex items-center gap-2 rounded-xl border border-[var(--line-soft)] px-3 py-2 text-xs">
                    <Search size={14} />
                    <input
                      value={globalQuery}
                      onChange={(e) => setGlobalQuery(e.target.value)}
                      placeholder="Search schools by name/code..."
                      className="w-[250px] bg-transparent outline-none"
                    />
                  </div>
                  {globalResults.length ? (
                    <div className="glass absolute right-0 z-30 mt-2 w-[330px] p-2">
                      {globalResults.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setGlobalQuery("");
                            setGlobalResults([]);
                            setModuleKey("schools");
                            void openSchoolDetail(s.id);
                          }}
                          className="mb-2 w-full rounded-lg border border-[var(--line-soft)] px-2 py-2 text-left text-xs hover-glow last:mb-0"
                        >
                          <p className="m-0 font-medium">{s.name}</p>
                          <p className="m-0 mt-1 text-[var(--text-muted)]">
                            {s.code} â€¢ {s.email}
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => applyTheme(theme === "dark" ? "light" : "dark")}
                  className="hover-glow rounded-xl border border-[var(--line-soft)] p-2"
                >
                  {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowNotifications((v) => !v)}
                    className="hover-glow rounded-xl border border-[var(--line-soft)] p-2"
                  >
                    <Bell size={15} />
                  </button>
                  {kpis?.pendingApprovals ? (
                    <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#0F3C78] px-1 text-[10px] font-semibold text-white">
                      {Math.min(kpis.pendingApprovals, 99)}
                    </span>
                  ) : null}
                  {showNotifications ? (
                    <div className="glass absolute right-0 z-30 mt-2 w-[280px] p-2 text-xs">
                      <p className="m-0 px-2 py-1 text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
                        Notifications
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNotifications(false);
                          setModuleKey("overview");
                          void openDrilldown("pending_approvals", filters.end);
                        }}
                        className="mt-1 w-full rounded-lg border border-[var(--line-soft)] px-2 py-2 text-left hover-glow"
                      >
                        <p className="m-0 font-medium">Pending approvals need attention</p>
                        <p className="m-0 mt-1 text-[var(--text-muted)]">
                          {fmtInt(kpis?.pendingApprovals || 0)} schools waiting
                        </p>
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowUserMenu((v) => !v)}
                    className="hover-glow rounded-xl border border-[var(--line-soft)] px-3 py-2 text-xs"
                  >
                    {role.replaceAll("_", " ")}
                  </button>
                  {showUserMenu ? (
                    <div className="glass absolute right-0 z-30 mt-2 w-[220px] p-2 text-xs">
                      <p className="m-0 px-2 py-1 text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
                        Account
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setShowUserMenu(false);
                          setModuleKey("settings");
                        }}
                        className="mt-1 w-full rounded-lg border border-[var(--line-soft)] px-2 py-2 text-left hover-glow"
                      >
                        Open Settings
                      </button>
                      {isControlAdmin ? (
                        <button
                          type="button"
                          onClick={() => {
                            setShowUserMenu(false);
                            router.push("/dashboard/access");
                          }}
                          className="mt-1 w-full rounded-lg border border-[var(--line-soft)] px-2 py-2 text-left hover-glow"
                        >
                          Access Management
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={logout}
                        className="mt-1 w-full rounded-lg border border-[var(--line-soft)] px-2 py-2 text-left hover-glow"
                      >
                        Logout
                      </button>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="hover-glow rounded-xl border border-[var(--line-soft)] px-4 py-2 text-xs"
                >
                  Logout
                </button>
              </div>
            </div>
          </header>

          {moduleKey === "overview" ? (
            <section className="glass space-y-3 p-3">
              <div className="flex items-center justify-between">
                <p className="m-0 text-xs text-[var(--text-muted)]">
                  Filters apply to KPI tiles, trends, and sales leaderboard.
                </p>
                <button
                  type="button"
                  onClick={() => setFilters(defaultMonthRange())}
                  className="rounded-xl border border-[var(--line-soft)] px-3 py-1.5 text-xs hover-glow"
                >
                  Reset
                </button>
              </div>
              <div className="grid gap-2 md:grid-cols-6">
                <label className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs">
                  <span className="mb-1 block text-[11px] text-[var(--text-muted)]">Start</span>
                  <input
                    type="date"
                    value={filters.start}
                    onChange={(e) => setFilters((p) => ({ ...p, start: e.target.value }))}
                    className="w-full bg-transparent outline-none"
                  />
                </label>
                <label className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs">
                  <span className="mb-1 block text-[11px] text-[var(--text-muted)]">End</span>
                  <input
                    type="date"
                    value={filters.end}
                    onChange={(e) => setFilters((p) => ({ ...p, end: e.target.value }))}
                    className="w-full bg-transparent outline-none"
                  />
                </label>
                <label className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs">
                  <span className="mb-1 block text-[11px] text-[var(--text-muted)]">Sales person</span>
                  <select
                    value={filters.salesOwnerId}
                    onChange={(e) => setFilters((p) => ({ ...p, salesOwnerId: e.target.value }))}
                    className="w-full bg-transparent outline-none"
                  >
                    <option value="">All sales persons</option>
                    {salesOwners.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs">
                  <span className="mb-1 block text-[11px] text-[var(--text-muted)]">Region / city</span>
                  <input
                    value={filters.region}
                    onChange={(e) => setFilters((p) => ({ ...p, region: e.target.value }))}
                    placeholder="e.g. North"
                    className="w-full bg-transparent outline-none"
                  />
                </label>
                <label className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs">
                  <span className="mb-1 block text-[11px] text-[var(--text-muted)]">School status</span>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value as SchoolStatus | "" }))}
                    className="w-full bg-transparent outline-none"
                  >
                    <option value="">All status</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => void loadOverview()}
                  className="rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-3 py-2 text-xs font-semibold text-white"
                >
                  <span className="inline-flex items-center gap-2">
                    <RefreshCcw size={14} />
                    Refresh
                  </span>
                </button>
              </div>

              {activeFilterChips.length ? (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 text-[var(--text-muted)]">
                    <Filter size={12} /> Active filters
                  </span>
                  {activeFilterChips.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() =>
                        setFilters((p) => ({
                          ...p,
                          [chip.key]: ""
                        }))
                      }
                      className="hover-glow inline-flex items-center gap-1 rounded-full border border-[var(--line-soft)] px-3 py-1"
                    >
                      {chip.label} <X size={12} />
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {success ? <p className="text-xs text-emerald-300">{success}</p> : null}
          {error ? <p className="text-xs text-rose-300">{error}</p> : null}

          <AnimatePresence mode="wait">
            <motion.div
              key={moduleKey}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-4"
            >
              {moduleKey === "overview" ? (
                <>
                  <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <KpiTile
                      label="Total Schools"
                      value={kpis?.totalSchools}
                      loading={loading.overview}
                      onClick={() => setModuleKey("schools")}
                    />
                    <KpiTile
                      label="Active Schools (30d)"
                      value={kpis?.activeSchools}
                      loading={loading.overview}
                      onClick={() => setModuleKey("schools")}
                    />
                    <KpiTile
                      label="Pending Approvals"
                      value={kpis?.pendingApprovals}
                      loading={loading.overview}
                      onClick={() => void openDrilldown("pending_approvals", filters.end)}
                    />
                    <KpiTile
                      label="Total Students Onboarded"
                      value={kpis?.totalStudentsAllTime}
                      loading={loading.overview}
                      onClick={() => void openDrilldown("submissions", filters.end)}
                    />
                    <KpiTile
                      label="Students Onboarded (MTD)"
                      value={kpis?.studentsMTD}
                      loading={loading.overview}
                      onClick={() => void openDrilldown("submissions", filters.end)}
                    />
                    <KpiTile
                      label="Revenue (MTD)"
                      value={kpis?.revenueMTD}
                      loading={loading.overview}
                      asCurrency
                      onClick={() => void openDrilldown("revenue", filters.end)}
                    />
                    <KpiTile
                      label="Collections (MTD)"
                      value={kpis?.collectionsMTD}
                      loading={loading.overview}
                      asCurrency
                      onClick={() => void openDrilldown("revenue", filters.end)}
                    />
                    <KpiTile
                      label="Outstanding AR"
                      value={kpis?.outstandingAR}
                      loading={loading.overview}
                      asCurrency
                      onClick={() => setModuleKey("billing")}
                    />
                    {kpis?.grossMarginMTD !== null || loading.overview ? (
                      <KpiTile
                        label="Gross Margin (MTD)"
                        value={kpis?.grossMarginMTD}
                        loading={loading.overview}
                        asCurrency
                        onClick={() => setModuleKey("reports")}
                      />
                    ) : null}
                  </section>

                  <section className="grid gap-4 xl:grid-cols-3">
                    <TrendCard
                      title="Parent Submissions Trend"
                      subtitle="Daily time-series (live)"
                      points={submissions}
                      loading={loading.overview}
                      onPointClick={(d) => void openDrilldown("submissions", d)}
                    />
                    <TrendCard
                      title="Approval Trend"
                      subtitle="Daily approved count"
                      points={approvals}
                      loading={loading.overview}
                      onPointClick={(d) => void openDrilldown("approvals", d)}
                    />
                    <TrendCard
                      title="Revenue Trend"
                      subtitle="Daily invoice totals"
                      points={revenue}
                      loading={loading.overview}
                      asCurrency
                      onPointClick={(d) => void openDrilldown("revenue", d)}
                    />
                  </section>

                  <article className="glass p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="m-0 text-sm font-semibold">Sales Performance (MTD)</p>
                      <p className="m-0 text-xs text-[var(--text-muted)]">
                        Last updated: {kpis?.serverTime ? new Date(kpis.serverTime).toLocaleString() : "--"}
                      </p>
                    </div>
                    {loading.overview ? (
                      <Skeleton className="h-56 rounded-xl" />
                    ) : salesRows.length ? (
                      <div className="overflow-auto rounded-xl border border-[var(--line-soft)]">
                        <table className="w-full min-w-[760px] text-left text-xs">
                          <thead className="bg-[var(--surface-strong)] text-[var(--text-muted)]">
                            <tr>
                              <th className="px-3 py-2">Sales Person</th>
                              <th className="px-3 py-2">Revenue</th>
                              <th className="px-3 py-2">Schools Active</th>
                              <th className="px-3 py-2">Students MTD</th>
                              <th className="px-3 py-2">Share</th>
                            </tr>
                          </thead>
                          <tbody>
                            {salesRows.map((r) => {
                              const maxRevenue = Math.max(...salesRows.map((row) => row.revenue), 1);
                              const width = Math.max((r.revenue / maxRevenue) * 100, 3);
                              return (
                                <tr key={r.salesOwnerId || "unassigned"} className="border-t border-[var(--line-soft)]">
                                  <td className="px-3 py-2">{r.salesOwnerName}</td>
                                  <td className="px-3 py-2">INR {fmtMoney(r.revenue)}</td>
                                  <td className="px-3 py-2">{fmtInt(r.schoolsActive)}</td>
                                  <td className="px-3 py-2">{fmtInt(r.studentsMTD)}</td>
                                  <td className="px-3 py-2">
                                    <div className="h-2 w-36 rounded-full bg-[var(--workflow-track)]">
                                      <div
                                        className="h-full rounded-full bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)]"
                                        style={{ width: `${width}%` }}
                                      />
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <EmptyState text="No sales rows for selected filters." />
                    )}
                  </article>
                </>
              ) : null}

              {moduleKey === "schools" ? (
                <section className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
                  <article className="glass p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="m-0 text-sm font-semibold">Schools</p>
                      <div className="flex items-center gap-2">
                        <input
                          value={schoolSearch}
                          onChange={(e) => setSchoolSearch(e.target.value)}
                          placeholder="Filter schools..."
                          className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => void loadSchools()}
                          className="rounded-xl border border-[var(--line-soft)] px-3 py-2 text-xs hover-glow"
                        >
                          Reload
                        </button>
                      </div>
                    </div>

                    {loading.schools ? (
                      <Skeleton className="h-72 rounded-xl" />
                    ) : filteredSchools.length ? (
                      <div className="overflow-auto rounded-xl border border-[var(--line-soft)]">
                        <table className="w-full min-w-[780px] text-left text-xs">
                          <thead className="bg-[var(--surface-strong)] text-[var(--text-muted)]">
                            <tr>
                              <th className="px-3 py-2">School</th>
                              <th className="px-3 py-2">Code</th>
                              <th className="px-3 py-2">Email</th>
                              <th className="px-3 py-2">Region</th>
                              <th className="px-3 py-2">Status</th>
                              <th className="px-3 py-2">Sales Person</th>
                              <th className="px-3 py-2">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredSchools.map((s) => (
                              <tr key={s.id} className="border-t border-[var(--line-soft)]">
                                <td className="px-3 py-2 font-medium">{s.name}</td>
                                <td className="px-3 py-2">{s.code}</td>
                                <td className="px-3 py-2">{s.email}</td>
                                <td className="px-3 py-2">
                                  {[s.city, s.state].filter(Boolean).join(", ") || "--"}
                                </td>
                                <td className="px-3 py-2">{s.status || "--"}</td>
                                <td className="px-3 py-2">{s.salesOwner?.name || s.salesOwner?.email || "--"}</td>
                                <td className="px-3 py-2">
                                  <button
                                    type="button"
                                    onClick={() => void openSchoolDetail(s.id)}
                                    className="hover-glow inline-flex items-center gap-1 rounded-lg border border-[var(--line-soft)] px-2 py-1 text-[11px]"
                                  >
                                    <Eye size={12} />
                                    View
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <EmptyState text="No schools available for current filter." />
                    )}
                  </article>

                  <article className="glass p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Plus size={16} />
                        <p className="m-0 text-sm font-semibold">Add School</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAddSchoolForm((v) => !v)}
                        className="rounded-xl border border-[var(--line-soft)] px-3 py-1.5 text-xs hover-glow"
                      >
                        {showAddSchoolForm ? "Hide form" : "Add New School"}
                      </button>
                    </div>
                    {showAddSchoolForm ? (
                      <div className="grid gap-2">
                      <InputField label="School Name" value={schoolForm.name} onChange={(v) => setSchoolForm((p) => ({ ...p, name: v }))} />
                      <InputField
                        label="Code (optional, auto-generated if blank)"
                        value={schoolForm.code}
                        onChange={(v) => setSchoolForm((p) => ({ ...p, code: v.toUpperCase() }))}
                      />
                      <InputField label="School Email" value={schoolForm.email} onChange={(v) => setSchoolForm((p) => ({ ...p, email: v }))} />
                      <InputField label="Phone" value={schoolForm.phone} onChange={(v) => setSchoolForm((p) => ({ ...p, phone: v }))} />
                      <div className="grid grid-cols-2 gap-2">
                        <InputField label="City" value={schoolForm.city} onChange={(v) => setSchoolForm((p) => ({ ...p, city: v }))} />
                        <InputField label="State" value={schoolForm.state} onChange={(v) => setSchoolForm((p) => ({ ...p, state: v }))} />
                      </div>
                      <InputField label="Principal Name" value={schoolForm.principalName} onChange={(v) => setSchoolForm((p) => ({ ...p, principalName: v }))} />
                      <InputField label="Principal Email" value={schoolForm.principalEmail} onChange={(v) => setSchoolForm((p) => ({ ...p, principalEmail: v }))} />
                      <InputField label="Principal Phone" value={schoolForm.principalPhone} onChange={(v) => setSchoolForm((p) => ({ ...p, principalPhone: v }))} />
                      <label className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs">
                        <span className="mb-1 block text-[11px] text-[var(--text-muted)]">Status</span>
                        <select
                          value={schoolForm.status}
                          onChange={(e) => setSchoolForm((p) => ({ ...p, status: e.target.value as SchoolStatus }))}
                          className="w-full bg-transparent outline-none"
                        >
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="INACTIVE">INACTIVE</option>
                        </select>
                      </label>
                      <label className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs">
                        <span className="mb-1 block text-[11px] text-[var(--text-muted)]">Assign Sales Person</span>
                        <select
                          value={schoolForm.salesOwnerId}
                          onChange={(e) => setSchoolForm((p) => ({ ...p, salesOwnerId: e.target.value }))}
                          className="w-full bg-transparent outline-none"
                        >
                          <option value="">Unassigned</option>
                          {salesOwners.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <InputField label="School Admin Email" value={schoolForm.adminEmail} onChange={(v) => setSchoolForm((p) => ({ ...p, adminEmail: v }))} />
                        <InputField
                          label="School Admin Password"
                          value={schoolForm.adminPassword}
                          onChange={(v) => setSchoolForm((p) => ({ ...p, adminPassword: v }))}
                          type="password"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => void submitSchool()}
                        disabled={loading.createSchool}
                        className="mt-1 rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {loading.createSchool ? "Creating..." : "Create School"}
                      </button>
                      </div>
                    ) : (
                      <EmptyState text="Use Add New School to open the onboarding form." />
                    )}
                  </article>
                </section>
              ) : null}

              {moduleKey === "users" ? (
                <section className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
                  <article className="glass p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="m-0 text-sm font-semibold">Employees</p>
                      <div className="flex items-center gap-2">
                        <select
                          value={userRoleFilter}
                          onChange={(e) => setUserRoleFilter(e.target.value as RoleKey | "")}
                          className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs outline-none"
                        >
                          <option value="">All roles</option>
                          {USER_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => void loadUsers()}
                          className="rounded-xl border border-[var(--line-soft)] px-3 py-2 text-xs hover-glow"
                        >
                          Reload
                        </button>
                      </div>
                    </div>
                    {loading.users ? (
                      <Skeleton className="h-72 rounded-xl" />
                    ) : filteredUsers.length ? (
                      <div className="overflow-auto rounded-xl border border-[var(--line-soft)]">
                        <table className="w-full min-w-[760px] text-left text-xs">
                          <thead className="bg-[var(--surface-strong)] text-[var(--text-muted)]">
                            <tr>
                              <th className="px-3 py-2">Email</th>
                              <th className="px-3 py-2">Name</th>
                              <th className="px-3 py-2">Role</th>
                              <th className="px-3 py-2">Active</th>
                              <th className="px-3 py-2">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredUsers.map((u) => (
                              <tr key={u.id} className="border-t border-[var(--line-soft)]">
                                <td className="px-3 py-2">{u.email}</td>
                                <td className="px-3 py-2">{u.name || "--"}</td>
                                <td className="px-3 py-2">{u.role}</td>
                                <td className="px-3 py-2">{u.isActive ? "YES" : "NO"}</td>
                                <td className="px-3 py-2">
                                  <button
                                    type="button"
                                    onClick={() => void deleteUser(u.id)}
                                    className="hover-glow rounded-lg border border-[var(--line-soft)] px-2 py-1 text-[11px]"
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <EmptyState text="No users for selected role." />
                    )}

                    <div className="mt-4 rounded-xl border border-[var(--line-soft)]">
                      <div className="border-b border-[var(--line-soft)] px-3 py-2 text-xs font-semibold">
                        RBAC Matrix
                      </div>
                      <div className="overflow-auto">
                        <table className="w-full min-w-[980px] text-left text-xs">
                          <thead className="bg-[var(--surface-strong)] text-[var(--text-muted)]">
                            <tr>
                              <th className="px-3 py-2">Role</th>
                              {RBAC_MODULES.map((module) => (
                                <th key={module} className="px-3 py-2">
                                  {module.toUpperCase()}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {RBAC_MATRIX.map((row) => (
                              <tr key={row.role} className="border-t border-[var(--line-soft)]">
                                <td className="px-3 py-2 font-medium">{row.role}</td>
                                {RBAC_MODULES.map((module) => (
                                  <td key={`${row.role}-${module}`} className="px-3 py-2">
                                    {row.modules.includes(module) ? "YES" : "--"}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </article>

                  <article className="glass p-4">
                    <p className="m-0 mb-3 text-sm font-semibold">Create Employee</p>
                    <div className="grid gap-2">
                      <p className="m-0 text-[11px] text-[var(--text-muted)]">
                        Company employees only. School accounts are created from school onboarding.
                      </p>
                      <InputField label="Work Email" value={userForm.email} onChange={(v) => setUserForm((p) => ({ ...p, email: v }))} />
                      <InputField
                        label="Password"
                        value={userForm.password}
                        onChange={(v) => setUserForm((p) => ({ ...p, password: v }))}
                        type="password"
                      />
                      <label className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs">
                        <span className="mb-1 block text-[11px] text-[var(--text-muted)]">Role</span>
                        <select
                          value={userForm.role}
                          onChange={(e) => setUserForm((p) => ({ ...p, role: e.target.value as RoleKey }))}
                          className="w-full bg-transparent outline-none"
                        >
                          {USER_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </label>
                      <InputField label="Phone" value={userForm.phone} onChange={(v) => setUserForm((p) => ({ ...p, phone: v }))} />
                      <button
                        type="button"
                        onClick={() => void submitUser()}
                        disabled={loading.createUser}
                        className="mt-1 rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {loading.createUser ? "Creating..." : "Create User"}
                      </button>
                    </div>
                  </article>
                </section>
              ) : null}

              {moduleKey === "templates" ? (
                <section className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
                  <article className="glass p-4 xl:col-span-2">
                    <div className="mb-3 flex flex-wrap items-end gap-2">
                      <label className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs">
                        <span className="mb-1 block text-[11px] text-[var(--text-muted)]">School Context</span>
                        <select
                          value={templateSchoolId}
                          onChange={(e) => setTemplateSchoolId(e.target.value)}
                          className="w-[300px] bg-transparent outline-none"
                        >
                          <option value="">Select school</option>
                          {schools.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.code})
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          if (!templateSchoolId) return;
                          void Promise.all([
                            loadTemplates(templateSchoolId),
                            loadTemplateAssignments(templateSchoolId),
                            loadRenderBatches(templateSchoolId)
                          ]);
                        }}
                        className="rounded-xl border border-[var(--line-soft)] px-3 py-2 text-xs hover-glow"
                      >
                        Reload
                      </button>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <div>
                        <p className="mb-2 text-sm font-semibold">Template List</p>
                        {loading.templates ? (
                          <Skeleton className="h-52 rounded-xl" />
                        ) : templates.length ? (
                          <div className="overflow-auto rounded-xl border border-[var(--line-soft)]">
                            <table className="w-full min-w-[760px] text-left text-xs">
                              <thead className="bg-[var(--surface-strong)] text-[var(--text-muted)]">
                                <tr>
                                  <th className="px-3 py-2">Template</th>
                                  <th className="px-3 py-2">Status</th>
                                  <th className="px-3 py-2">Type</th>
                                  <th className="px-3 py-2">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {templates.map((t) => (
                                  <tr key={t.id} className="border-t border-[var(--line-soft)]">
                                    <td className="px-3 py-2">
                                      <p className="m-0 font-medium">{t.name}</p>
                                      <p className="m-0 mt-1 text-[11px] text-[var(--text-muted)]">
                                        {t.templateCode || t.id.slice(0, 8)}
                                      </p>
                                    </td>
                                    <td className="px-3 py-2">{t.status}</td>
                                    <td className="px-3 py-2">{t.cardType}</td>
                                    <td className="px-3 py-2">
                                      <div className="flex flex-wrap gap-1">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedTemplateId(t.id);
                                            setAssignmentForm((p) => ({ ...p, templateId: t.id }));
                                            setRenderBatchForm((p) => ({ ...p, templateId: t.id }));
                                          }}
                                          className="rounded-md border border-[var(--line-soft)] px-2 py-1 text-[11px] hover-glow"
                                        >
                                          Select
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void changeTemplateStatus(t.id, "PUBLISHED")}
                                          className="rounded-md border border-[var(--line-soft)] px-2 py-1 text-[11px] hover-glow"
                                        >
                                          Publish
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void duplicateTemplateAction(t.id)}
                                          className="rounded-md border border-[var(--line-soft)] px-2 py-1 text-[11px] hover-glow"
                                        >
                                          Duplicate
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <EmptyState text="No templates for selected school." />
                        )}
                      </div>

                      <div>
                        <p className="mb-2 text-sm font-semibold">Create Template</p>
                        <div className="grid gap-2">
                          <InputField label="Template Name" value={templateForm.name} onChange={(v) => setTemplateForm((p) => ({ ...p, name: v }))} />
                          <InputField label="Template Code" value={templateForm.templateCode} onChange={(v) => setTemplateForm((p) => ({ ...p, templateCode: v.toUpperCase() }))} />
                          <label className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs">
                            <span className="mb-1 block text-[11px] text-[var(--text-muted)]">Card Type</span>
                            <select
                              value={templateForm.cardType}
                              onChange={(e) => setTemplateForm((p) => ({ ...p, cardType: e.target.value }))}
                              className="w-full bg-transparent outline-none"
                            >
                              <option value="STUDENT">STUDENT</option>
                              <option value="STAFF">STAFF</option>
                              <option value="VISITOR">VISITOR</option>
                              <option value="EMPLOYEE">EMPLOYEE</option>
                              <option value="CUSTOM">CUSTOM</option>
                            </select>
                          </label>
                          <label className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs">
                            <span className="mb-1 block text-[11px] text-[var(--text-muted)]">Institution Type</span>
                            <select
                              value={templateForm.institutionType}
                              onChange={(e) => setTemplateForm((p) => ({ ...p, institutionType: e.target.value }))}
                              className="w-full bg-transparent outline-none"
                            >
                              <option value="SCHOOL">SCHOOL</option>
                              <option value="COLLEGE">COLLEGE</option>
                              <option value="COMPANY">COMPANY</option>
                            </select>
                          </label>
                          <button
                            type="button"
                            onClick={() => void submitTemplate()}
                            disabled={loading.createTemplate}
                            className="rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                          >
                            {loading.createTemplate ? "Creating..." : "Create Template"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>

                  <article className="glass p-4 xl:col-span-2">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="m-0 text-sm font-semibold">Template Studio</p>
                        <span className="rounded-full border border-[var(--line-soft)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
                          Drag and drop editor
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setStudioSide("front")}
                          className={`rounded-lg border px-2.5 py-1 text-xs ${
                            studioSide === "front"
                              ? "border-[#1C6ED5] bg-[#1C6ED5]/15"
                              : "border-[var(--line-soft)]"
                          }`}
                        >
                          Front
                        </button>
                        <button
                          type="button"
                          onClick={() => setStudioSide("back")}
                          className={`rounded-lg border px-2.5 py-1 text-xs ${
                            studioSide === "back"
                              ? "border-[#1C6ED5] bg-[#1C6ED5]/15"
                              : "border-[var(--line-soft)]"
                          }`}
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={() => void renderStudioTemplatePreview()}
                          className="rounded-lg border border-[var(--line-soft)] px-2.5 py-1 text-xs hover-glow"
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => void saveStudioTemplate()}
                          disabled={studioSaving}
                          className="rounded-lg bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          {studioSaving ? "Saving..." : "Save Layout"}
                        </button>
                      </div>
                    </div>

                    <div className="mb-3 grid gap-2 rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] p-3 text-xs lg:grid-cols-[1fr_1fr_1fr_1fr]">
                      <InputCompact
                        label="Project Name"
                        value={templateForm.name}
                        onChange={(v) => setTemplateForm((p) => ({ ...p, name: v }))}
                      />
                      <label className="rounded-lg border border-[var(--line-soft)] bg-[var(--surface)] px-2 py-1.5">
                        <span className="mb-1 block text-[11px] text-[var(--text-muted)]">Project Type</span>
                        <select
                          value={studioProjectType}
                          onChange={(e) => {
                            const val = e.target.value as "SINGLE_SIDED" | "BOTH_SIDED";
                            setStudioProjectType(val);
                            setRenderBatchForm((prev) => ({
                              ...prev,
                              sideMode: val === "BOTH_SIDED" ? "FRONT_BACK" : "FRONT_ONLY"
                            }));
                          }}
                          className="w-full bg-transparent outline-none"
                        >
                          <option value="SINGLE_SIDED">Single Sided</option>
                          <option value="BOTH_SIDED">Both Sided</option>
                        </select>
                      </label>
                      <label className="rounded-lg border border-[var(--line-soft)] bg-[var(--surface)] px-2 py-1.5">
                        <span className="mb-1 block text-[11px] text-[var(--text-muted)]">Layout</span>
                        <select
                          value={studioLayoutPreset}
                          onChange={(e) => applyLayoutPreset(e.target.value)}
                          className="w-full bg-transparent outline-none"
                        >
                          {CARD_LAYOUT_PRESETS.map((preset) => (
                            <option key={preset.key} value={preset.key}>
                              {preset.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <InputCompact label="Width (mm)" value={studioWidthMm} onChange={setStudioWidthMm} />
                        <InputCompact label="Height (mm)" value={studioHeightMm} onChange={setStudioHeightMm} />
                      </div>
                      <button
                        type="button"
                        onClick={() => applyStudioSize()}
                        className="rounded-lg border border-[var(--line-soft)] bg-[var(--surface)] px-2 py-1.5 hover-glow"
                      >
                        Apply Size
                      </button>
                    </div>

                    <div className="grid gap-3 xl:grid-cols-[56px_1fr_260px]">
                      <div className="rounded-xl border border-[#1f2a43] bg-[#0a0f1b] p-1.5 text-white">
                        <p className="m-0 mb-1 text-center text-[10px] font-semibold tracking-[0.14em] text-slate-300">
                          FIX
                        </p>
                        <div className="flex flex-col gap-1.5">
                          {(
                            [
                              { type: "photo", label: "Image", icon: ImageIcon },
                              { type: "text", label: "Text", icon: Type },
                              { type: "barcode", label: "Barcode", icon: Barcode },
                              { type: "qr", label: "QR", icon: QrCode },
                              { type: "shape", label: "Shape", icon: Square },
                              { type: "line", label: "Line", icon: Minus }
                            ] as Array<{ type: StudioElementType; label: string; icon: typeof Type }>
                          ).map((item) => (
                            <button
                              key={item.type}
                              type="button"
                              title={item.label}
                              onClick={() => addStudioElement(item.type)}
                              className="grid h-9 place-items-center rounded-md border border-white/10 bg-white/5 transition hover:bg-white/15"
                            >
                              <item.icon size={13} />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-xl border border-[#1f2a43] bg-[#070d18] p-3 text-white">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2">
                          <p className="m-0 text-xs font-semibold tracking-wide text-slate-200">
                            Online ID Card • {studioSide === "front" ? "[Front]" : "[Rear]"}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => void renderStudioTemplatePreview()}
                              className="rounded-md border border-white/20 px-2 py-1 text-[11px] transition hover:bg-white/10"
                            >
                              Preview
                            </button>
                            <button
                              type="button"
                              onClick={() => void saveStudioTemplate()}
                              disabled={studioSaving}
                              className="rounded-md bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
                            >
                              {studioSaving ? "Saving..." : "Save Layout"}
                            </button>
                          </div>
                        </div>

                        <div className="min-h-[460px] overflow-auto rounded-xl border border-white/10 bg-[radial-gradient(circle_at_top,#0f1c34,#070d18)] p-4">
                          <div className="grid min-h-[430px] place-items-center">
                            <div
                              style={{
                                transform: `scale(${Math.max(35, Math.min(200, Number(studioZoom) || 100)) / 100})`,
                                transformOrigin: "center center"
                              }}
                            >
                              <div
                                ref={studioCanvasRef}
                                style={{ width: studioLayout.width, height: studioLayout.height }}
                                className="relative overflow-hidden rounded-2xl border border-white/15 bg-white shadow-[0_22px_60px_rgba(0,0,0,0.35)]"
                              >
                                <div className="pointer-events-none absolute inset-[10px] rounded-xl border border-dashed border-rose-500/70" />
                                {studioLayout.elements.map((element) => {
                                  const selected = element.id === studioSelectedElementId;
                                  const lineVisual = element.type === "line";
                                  return (
                                    <div
                                      key={element.id}
                                      role="button"
                                      tabIndex={0}
                                      onMouseDown={(event) => {
                                        if (event.button !== 0) return;
                                        event.preventDefault();
                                        setStudioSelectedElementId(element.id);
                                        if (element.locked) return;
                                        setStudioDrag({
                                          id: element.id,
                                          startX: event.clientX,
                                          startY: event.clientY,
                                          originX: element.x,
                                          originY: element.y
                                        });
                                      }}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                          setStudioSelectedElementId(element.id);
                                        }
                                      }}
                                      className={`absolute select-none rounded-md border text-[11px] ${
                                        selected ? "ring-2 ring-[#1C6ED5] ring-offset-1 ring-offset-white" : ""
                                      } ${element.locked ? "cursor-default" : "cursor-move"}`}
                                      style={{
                                        left: element.x,
                                        top: element.y,
                                        width: element.width,
                                        height: element.height,
                                        borderColor: lineVisual ? "transparent" : element.borderColor || "#64748b",
                                        borderRadius: element.borderRadius || 0,
                                        background: lineVisual ? "transparent" : element.background || "transparent",
                                        color: element.color || "#0f172a"
                                      }}
                                    >
                                      {element.type === "text" ? (
                                        <div
                                          className="h-full w-full px-1.5 py-1"
                                          style={{
                                            fontSize: element.fontSize || 14,
                                            fontWeight: element.fontWeight || 500,
                                            textAlign: element.textAlign || "left",
                                            fontFamily: studioFontFamily,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap"
                                          }}
                                        >
                                          {element.text || "Text"}
                                        </div>
                                      ) : null}
                                      {element.type === "photo" ? (
                                        <div className="grid h-full w-full place-items-center text-slate-500">
                                          <ImageIcon size={16} />
                                        </div>
                                      ) : null}
                                      {element.type === "qr" ? (
                                        <div className="grid h-full w-full place-items-center text-slate-500">
                                          <QrCode size={16} />
                                        </div>
                                      ) : null}
                                      {element.type === "barcode" ? (
                                        <div className="grid h-full w-full place-items-center text-slate-500">
                                          <Barcode size={16} />
                                        </div>
                                      ) : null}
                                      {element.type === "shape" ? <div className="h-full w-full" /> : null}
                                      {element.type === "line" ? (
                                        <div className="h-full w-full rounded-full bg-slate-500" />
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>

                        {studioWarnings.length ? (
                          <div className="mt-2 rounded-lg border border-amber-300/40 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-200">
                            {studioWarnings.map((warn, idx) => (
                              <p key={`${warn}-${idx}`} className="m-0">
                                {warn}
                              </p>
                            ))}
                          </div>
                        ) : null}

                        <div className="mt-2 grid gap-1.5 rounded-lg border border-white/10 bg-[#0a0f1b] p-2 text-[11px] text-slate-200 md:grid-cols-[auto_auto_auto_1fr_auto_auto_auto_auto_auto_auto]">
                          <p className="m-0 rounded border border-white/10 px-2 py-1 font-medium">
                            {studioSide === "front" ? "CanvasFront" : "CanvasRear"}
                          </p>
                          <button
                            type="button"
                            onClick={() => addStudioElement("shape")}
                            className="rounded border border-white/10 px-2 py-1 text-left hover:bg-white/10"
                          >
                            Background: ...
                          </button>
                          <button
                            type="button"
                            onClick={() => void renderStudioTemplatePreview()}
                            className="rounded border border-white/10 px-2 py-1 text-left hover:bg-white/10"
                          >
                            Design Template: ...
                          </button>
                          <label className="rounded border border-white/10 px-2 py-1">
                            <span className="mr-2 text-slate-400">Display</span>
                            <select
                              value={studioDisplayMode}
                              onChange={(e) => setStudioDisplayMode(e.target.value as "CROPPED" | "FIT")}
                              className="bg-transparent outline-none"
                            >
                              <option value="CROPPED">Cropped</option>
                              <option value="FIT">Fit</option>
                            </select>
                          </label>
                          <input
                            value={
                              studioSelectedElement?.type === "text"
                                ? studioSelectedElement.text || ""
                                : ""
                            }
                            onChange={(e) => {
                              if (!studioSelectedElement || studioSelectedElement.type !== "text") return;
                              updateStudioElement(studioSelectedElement.id, { text: e.target.value });
                            }}
                            placeholder="Data: Type here"
                            className="rounded border border-white/10 bg-transparent px-2 py-1 outline-none"
                          />
                          <input
                            value={studioFontFamily}
                            onChange={(e) => setStudioFontFamily(e.target.value)}
                            placeholder="Font"
                            className="rounded border border-white/10 bg-transparent px-2 py-1 outline-none"
                          />
                          <input
                            value={String(studioSelectedElement?.fontSize || 14)}
                            onChange={(e) => {
                              if (!studioSelectedElement) return;
                              updateStudioElement(studioSelectedElement.id, {
                                fontSize: Number(e.target.value || 14)
                              });
                            }}
                            placeholder="Size"
                            className="w-16 rounded border border-white/10 bg-transparent px-2 py-1 outline-none"
                          />
                          <select
                            value={studioSelectedElement?.textAlign || "left"}
                            onChange={(e) => {
                              if (!studioSelectedElement || studioSelectedElement.type !== "text") return;
                              updateStudioElement(studioSelectedElement.id, {
                                textAlign: e.target.value as "left" | "center" | "right"
                              });
                            }}
                            className="rounded border border-white/10 bg-transparent px-2 py-1 outline-none"
                          >
                            <option value="left">TopLeft</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                          <input
                            type="color"
                            value={studioSelectedElement?.color || "#0f172a"}
                            onChange={(e) => {
                              if (!studioSelectedElement) return;
                              updateStudioElement(studioSelectedElement.id, { color: e.target.value });
                            }}
                            className="h-7 w-10 cursor-pointer rounded border border-white/10 bg-transparent"
                          />
                          <div className="flex items-center gap-1">
                            <select
                              value={studioTextMode}
                              onChange={(e) => setStudioTextMode(e.target.value)}
                              className="rounded border border-white/10 bg-transparent px-2 py-1 outline-none"
                            >
                              <option value="Vector">Vector</option>
                              <option value="Raster">Raster</option>
                            </select>
                            <input
                              value={studioDegree}
                              onChange={(e) => setStudioDegree(e.target.value)}
                              className="w-14 rounded border border-white/10 bg-transparent px-2 py-1 outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] p-2 text-xs">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="m-0 font-semibold">View</p>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => setStudioSide("front")}
                                className={`rounded-md border px-2 py-1 text-[11px] ${
                                  studioSide === "front"
                                    ? "border-[#1C6ED5] bg-[#1C6ED5]/15"
                                    : "border-[var(--line-soft)]"
                                }`}
                              >
                                Front
                              </button>
                              <button
                                type="button"
                                onClick={() => setStudioSide("back")}
                                className={`rounded-md border px-2 py-1 text-[11px] ${
                                  studioSide === "back"
                                    ? "border-[#1C6ED5] bg-[#1C6ED5]/15"
                                    : "border-[var(--line-soft)]"
                                }`}
                              >
                                Rear
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="rounded-md border border-[var(--line-soft)] bg-[var(--surface)] px-2 py-1">
                              <span className="block text-[10px] text-[var(--text-muted)]">Zoom %</span>
                              <input
                                value={studioZoom}
                                onChange={(e) => setStudioZoom(e.target.value)}
                                className="w-full bg-transparent text-[11px] outline-none"
                              />
                            </label>
                            <label className="rounded-md border border-[var(--line-soft)] bg-[var(--surface)] px-2 py-1">
                              <span className="block text-[10px] text-[var(--text-muted)]">Display</span>
                              <select
                                value={studioDisplayMode}
                                onChange={(e) => setStudioDisplayMode(e.target.value as "CROPPED" | "FIT")}
                                className="w-full bg-transparent text-[11px] outline-none"
                              >
                                <option value="CROPPED">CROPPED</option>
                                <option value="FIT">FIT</option>
                              </select>
                            </label>
                          </div>
                        </div>

                        <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] p-2 text-xs">
                          <p className="m-0 mb-2 font-semibold">Quick Links</p>
                          <div className="grid gap-1.5">
                            <button
                              type="button"
                              onClick={() => applyQuickAlignment("max-width")}
                              className="rounded-md border border-[var(--line-soft)] px-2 py-1 text-left text-[11px] hover-glow"
                            >
                              Max Length
                            </button>
                            <button
                              type="button"
                              onClick={() => applyQuickAlignment("h-center")}
                              className="rounded-md border border-[var(--line-soft)] px-2 py-1 text-left text-[11px] hover-glow"
                            >
                              Hori. Center
                            </button>
                            <button
                              type="button"
                              onClick={() => applyQuickAlignment("v-center")}
                              className="rounded-md border border-[var(--line-soft)] px-2 py-1 text-left text-[11px] hover-glow"
                            >
                              Vert. Center
                            </button>
                          </div>
                          <div className="mt-3 rounded-md border border-[var(--line-soft)] bg-[var(--surface)] p-2 text-[11px]">
                            <p className="m-0 mb-1 text-[10px] font-semibold text-[var(--text-muted)]">
                              DIMENSIONS (mm)
                            </p>
                            {studioSelectedMetrics ? (
                              <div className="space-y-0.5">
                                <p className="m-0">Left: {studioSelectedMetrics.left}</p>
                                <p className="m-0">Top: {studioSelectedMetrics.top}</p>
                                <p className="m-0">Width: {studioSelectedMetrics.width}</p>
                                <p className="m-0">Height: {studioSelectedMetrics.height}</p>
                              </div>
                            ) : (
                              <p className="m-0 text-[var(--text-muted)]">Select an element</p>
                            )}
                          </div>
                        </div>

                        <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] p-2 text-xs">
                          <p className="m-0 mb-2 font-semibold">Element Properties</p>
                          {studioSelectedElement ? (
                            <div className="grid gap-2">
                              <div className="grid grid-cols-2 gap-2">
                                <InputCompact
                                  label="X"
                                  value={String(studioSelectedElement.x)}
                                  onChange={(v) => updateStudioElement(studioSelectedElement.id, { x: Number(v || 0) })}
                                />
                                <InputCompact
                                  label="Y"
                                  value={String(studioSelectedElement.y)}
                                  onChange={(v) => updateStudioElement(studioSelectedElement.id, { y: Number(v || 0) })}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <InputCompact
                                  label="Width"
                                  value={String(studioSelectedElement.width)}
                                  onChange={(v) =>
                                    updateStudioElement(studioSelectedElement.id, { width: Number(v || 1) })
                                  }
                                />
                                <InputCompact
                                  label="Height"
                                  value={String(studioSelectedElement.height)}
                                  onChange={(v) =>
                                    updateStudioElement(studioSelectedElement.id, { height: Number(v || 1) })
                                  }
                                />
                              </div>
                              {studioSelectedElement.type === "text" ? (
                                <textarea
                                  value={studioSelectedElement.text || ""}
                                  onChange={(e) =>
                                    updateStudioElement(studioSelectedElement.id, { text: e.target.value })
                                  }
                                  className="h-16 resize-none rounded-md border border-[var(--line-soft)] bg-[var(--surface)] px-2 py-1 text-[11px] outline-none"
                                />
                              ) : null}
                              <div className="flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateStudioElement(studioSelectedElement.id, {
                                      locked: !studioSelectedElement.locked
                                    })
                                  }
                                  className="rounded-md border border-[var(--line-soft)] px-2 py-1 text-[11px] hover-glow"
                                >
                                  {studioSelectedElement.locked ? "Unlock" : "Lock"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => duplicateStudioElement(studioSelectedElement.id)}
                                  className="inline-flex items-center gap-1 rounded-md border border-[var(--line-soft)] px-2 py-1 text-[11px] hover-glow"
                                >
                                  <Copy size={11} />
                                  Duplicate
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeStudioElement(studioSelectedElement.id)}
                                  className="inline-flex items-center gap-1 rounded-md border border-rose-400/60 px-2 py-1 text-[11px] text-rose-500 hover-glow"
                                >
                                  <Trash2 size={11} />
                                  Delete
                                </button>
                              </div>
                            </div>
                          ) : (
                            <EmptyState text="Select an element on canvas to edit properties." />
                          )}
                        </div>

                        <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] p-2 text-xs">
                          <p className="m-0 mb-2 font-semibold">Quick Tokens</p>
                          <div className="flex max-h-24 flex-wrap gap-1 overflow-auto rounded-md border border-[var(--line-soft)] p-1.5">
                            {templateTokens.length ? (
                              templateTokens.map((token) => (
                                <button
                                  key={token.key}
                                  type="button"
                                  onClick={() => insertTokenIntoSelected(token.key)}
                                  className="rounded border border-[var(--line-soft)] px-1.5 py-0.5 text-[10px] hover-glow"
                                  title={token.label}
                                >
                                  {`{{${token.key}}}`}
                                </button>
                              ))
                            ) : (
                              <p className="m-0 text-[11px] text-[var(--text-muted)]">Token catalog loading...</p>
                            )}
                          </div>
                        </div>

                        <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] p-2 text-xs">
                          <p className="m-0 mb-2 font-semibold">Preview Payload</p>
                          {studioPreview ? (
                            <pre className="max-h-36 overflow-auto rounded-md border border-[var(--line-soft)] bg-[var(--surface)] p-2 text-[10px]">
                              {JSON.stringify(studioPreview, null, 2)}
                            </pre>
                          ) : (
                            <EmptyState text="Click Preview to validate token rendering." />
                          )}
                        </div>
                      </div>
                    </div>
                  </article>

                  <article className="glass p-4">
                    <p className="mb-3 text-sm font-semibold">Assignment</p>
                    <div className="grid gap-2">
                      <label className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs">
                        <span className="mb-1 block text-[11px] text-[var(--text-muted)]">Template</span>
                        <select
                          value={assignmentForm.templateId || selectedTemplateId}
                          onChange={(e) => setAssignmentForm((p) => ({ ...p, templateId: e.target.value }))}
                          className="w-full bg-transparent outline-none"
                        >
                          <option value="">Select template</option>
                          {templates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <InputField label="Scope" value={assignmentForm.scope} onChange={(v) => setAssignmentForm((p) => ({ ...p, scope: v }))} />
                      <InputField label="Class" value={assignmentForm.className} onChange={(v) => setAssignmentForm((p) => ({ ...p, className: v }))} />
                      <InputField label="Section" value={assignmentForm.section} onChange={(v) => setAssignmentForm((p) => ({ ...p, section: v }))} />
                      <button
                        type="button"
                        onClick={() => void submitTemplateAssignment()}
                        disabled={loading.upsertTemplateAssignment}
                        className="rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {loading.upsertTemplateAssignment ? "Saving..." : "Save Assignment"}
                      </button>
                    </div>
                  </article>

                  <article className="glass p-4">
                    <p className="mb-3 text-sm font-semibold">Render Batches</p>
                    {loading.renderBatches ? (
                      <Skeleton className="h-52 rounded-xl" />
                    ) : renderBatches.length ? (
                      <div className="space-y-2">
                        {renderBatches.slice(0, 8).map((batch) => (
                          <div key={batch.id} className="rounded-xl border border-[var(--line-soft)] p-2 text-xs">
                            <p className="m-0 font-medium">{batch.id.slice(0, 12)}</p>
                            <p className="m-0 mt-1 text-[var(--text-muted)]">
                              {batch.status} - {batch.successCount}/{batch.totalRecords}
                            </p>
                            <div className="mt-2 flex gap-1">
                              <button
                                type="button"
                                onClick={() => void exportRenderBatch(batch.id, "PDF")}
                                className="rounded-md border border-[var(--line-soft)] px-2 py-1 text-[11px] hover-glow"
                              >
                                Export PDF
                              </button>
                              <button
                                type="button"
                                onClick={() => void exportRenderBatch(batch.id, "JSON")}
                                className="rounded-md border border-[var(--line-soft)] px-2 py-1 text-[11px] hover-glow"
                              >
                                Export JSON
                              </button>
                              {batch.artifactUrl ? (
                                <button
                                  type="button"
                                  onClick={() => void downloadGeneratedArtifact("RENDER_BATCH", batch.id, `${batch.id}.bin`)}
                                  className="rounded-md border border-[var(--line-soft)] px-2 py-1 text-[11px] hover-glow"
                                >
                                  Download Latest
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState text="No render batches yet." />
                    )}
                    <button
                      type="button"
                      onClick={() => void triggerRenderBatch()}
                      disabled={loading.createRenderBatch}
                      className="mt-3 rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {loading.createRenderBatch ? "Generating..." : "Generate New Batch"}
                    </button>
                  </article>
                </section>
              ) : null}

              {moduleKey === "workflow" ? (
                <article className="glass p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="m-0 text-sm font-semibold">Workflow Control</p>
                    <button
                      type="button"
                      onClick={() => void loadReports()}
                      className="rounded-xl border border-[var(--line-soft)] px-3 py-2 text-xs hover-glow"
                    >
                      Reload
                    </button>
                  </div>

                  {loading.reports ? (
                    <Skeleton className="h-72 rounded-xl" />
                  ) : reports?.rows.length ? (
                    <div className="overflow-auto rounded-xl border border-[var(--line-soft)]">
                      <table className="w-full min-w-[980px] text-left text-xs">
                        <thead className="bg-[var(--surface-strong)] text-[var(--text-muted)]">
                          <tr>
                            <th className="px-3 py-2">School</th>
                            <th className="px-3 py-2">Submitted</th>
                            <th className="px-3 py-2">Approved</th>
                            <th className="px-3 py-2">In Print Queue</th>
                            <th className="px-3 py-2">Printed</th>
                            <th className="px-3 py-2">Delivered</th>
                            <th className="px-3 py-2">Rejected</th>
                            <th className="px-3 py-2">Completion %</th>
                            <th className="px-3 py-2">Drill</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reports.rows.map((r) => (
                            <tr key={r.schoolId} className="border-t border-[var(--line-soft)]">
                              <td className="px-3 py-2">{r.schoolName}</td>
                              <td className="px-3 py-2">{fmtInt(r.submitted)}</td>
                              <td className="px-3 py-2">{fmtInt(r.approved)}</td>
                              <td className="px-3 py-2">{fmtInt(r.inPrint)}</td>
                              <td className="px-3 py-2">{fmtInt(r.printed)}</td>
                              <td className="px-3 py-2">{fmtInt(r.delivered)}</td>
                              <td className="px-3 py-2">{fmtInt(r.rejected)}</td>
                              <td className="px-3 py-2">{r.completionPercent}%</td>
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  onClick={() => void openSchoolDetail(r.schoolId)}
                                  className="hover-glow rounded-lg border border-[var(--line-soft)] px-2 py-1 text-[11px]"
                                >
                                  Open
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState text="No workflow records for selected range." />
                  )}
                </article>
              ) : null}

              {moduleKey === "print-ops" ? (
                <section className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
                  <article className="glass p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="m-0 text-sm font-semibold">Print Jobs</p>
                      <button
                        type="button"
                        onClick={() => void loadPrintJobs()}
                        className="rounded-xl border border-[var(--line-soft)] px-3 py-2 text-xs hover-glow"
                      >
                        Reload
                      </button>
                    </div>
                    {loading.printOps ? (
                      <Skeleton className="h-72 rounded-xl" />
                    ) : printJobs.length ? (
                      <div className="overflow-auto rounded-xl border border-[var(--line-soft)]">
                        <table className="w-full min-w-[820px] text-left text-xs">
                          <thead className="bg-[var(--surface-strong)] text-[var(--text-muted)]">
                            <tr>
                              <th className="px-3 py-2">Print Job</th>
                              <th className="px-3 py-2">School</th>
                              <th className="px-3 py-2">Status</th>
                              <th className="px-3 py-2">Items</th>
                              <th className="px-3 py-2">Assigned</th>
                              <th className="px-3 py-2">Created</th>
                              <th className="px-3 py-2">Artifact</th>
                              <th className="px-3 py-2">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {printJobs.map((row) => (
                              <tr key={row.id} className="border-t border-[var(--line-soft)]">
                                <td className="px-3 py-2">{row.id.slice(0, 8)}</td>
                                <td className="px-3 py-2">{row.school?.name || "--"}</td>
                                <td className="px-3 py-2">{row.status}</td>
                                <td className="px-3 py-2">{row._count?.items ?? 0}</td>
                                <td className="px-3 py-2">{row.assignedTo?.email || "Unassigned"}</td>
                                <td className="px-3 py-2">{new Date(row.createdAt).toLocaleString()}</td>
                                <td className="px-3 py-2">
                                  <span
                                    className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${
                                      row.printFileUrl
                                        ? "bg-[rgba(28,110,213,0.12)] text-[var(--brand-action)]"
                                        : "bg-[var(--surface-strong)] text-[var(--text-muted)]"
                                    }`}
                                  >
                                    {row.printFileUrl ? "READY" : "PENDING"}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex flex-wrap gap-2">
                                    {canManagePrintArtifacts ? (
                                      <button
                                        type="button"
                                        onClick={() => void generatePrintArtifact(row.id)}
                                        disabled={activePrintJobActionId === row.id}
                                        className="hover-glow rounded-lg border border-[var(--line-soft)] px-2 py-1 text-[11px] disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        Generate PDF
                                      </button>
                                    ) : null}
                                    {canManagePrintArtifacts && row.printFileUrl ? (
                                      <button
                                        type="button"
                                        onClick={() => void downloadPrintArtifact(row.id)}
                                        disabled={activePrintJobActionId === row.id}
                                        className="hover-glow rounded-lg border border-[var(--line-soft)] px-2 py-1 text-[11px] disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        Download Latest
                                      </button>
                                    ) : null}
                                    {canManagePrintArtifacts ? (
                                      <button
                                        type="button"
                                        onClick={() => void exportPrintJobCsv(row.id)}
                                        disabled={activePrintJobActionId === row.id}
                                        className="hover-glow rounded-lg border border-[var(--line-soft)] px-2 py-1 text-[11px] disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        Export CSV
                                      </button>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <EmptyState text="No print jobs found." />
                    )}
                  </article>

                  <article className="glass p-4">
                    <p className="m-0 mb-3 text-sm font-semibold">Dispatch New Print Batch</p>
                    <div className="grid gap-2">
                      <label className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs">
                        <span className="mb-1 block text-[11px] text-[var(--text-muted)]">
                          Student IDs (comma separated)
                        </span>
                        <textarea
                          value={dispatchForm.studentIds}
                          onChange={(e) => setDispatchForm((p) => ({ ...p, studentIds: e.target.value }))}
                          className="h-24 w-full resize-none bg-transparent outline-none"
                        />
                      </label>
                      <label className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs">
                        <span className="mb-1 block text-[11px] text-[var(--text-muted)]">Assign print operator</span>
                        <select
                          value={dispatchForm.assignedToId}
                          onChange={(e) => setDispatchForm((p) => ({ ...p, assignedToId: e.target.value }))}
                          className="w-full bg-transparent outline-none"
                        >
                          <option value="">Auto / none</option>
                          {printingUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.email}
                            </option>
                          ))}
                        </select>
                      </label>
                      <InputField label="Notes" value={dispatchForm.notes} onChange={(v) => setDispatchForm((p) => ({ ...p, notes: v }))} />
                      <button
                        type="button"
                        onClick={() => void dispatchToPrint()}
                        disabled={loading.dispatch}
                        className="mt-1 rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {loading.dispatch ? "Dispatching..." : "Dispatch to Print"}
                      </button>
                    </div>
                  </article>
                </section>
              ) : null}

              {moduleKey === "reports" ? (
                <article className="glass p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="m-0 text-sm font-semibold">Reports</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void loadReports()}
                        className="rounded-xl border border-[var(--line-soft)] px-3 py-2 text-xs hover-glow"
                      >
                        Reload
                      </button>
                      <button
                        type="button"
                        onClick={() => void exportReportCsv()}
                        className="rounded-xl border border-[var(--line-soft)] px-3 py-2 text-xs hover-glow"
                      >
                        <span className="inline-flex items-center gap-1">
                          <Download size={12} />
                          Export CSV
                        </span>
                      </button>
                    </div>
                  </div>

                  {reports?.totals ? (
                    <div className="mb-3 grid gap-2 md:grid-cols-4">
                      <MiniStat label="Schools" value={fmtInt(reports.totals.schools)} />
                      <MiniStat label="Total Students" value={fmtInt(reports.totals.totalStudents)} />
                      <MiniStat label="Delivered" value={fmtInt(reports.totals.delivered)} />
                      <MiniStat label="Revenue" value={`INR ${fmtMoney(reports.totals.revenueInr)}`} />
                    </div>
                  ) : null}

                  {loading.reports ? (
                    <Skeleton className="h-72 rounded-xl" />
                  ) : reports?.rows.length ? (
                    <div className="overflow-auto rounded-xl border border-[var(--line-soft)]">
                      <table className="w-full min-w-[1080px] text-left text-xs">
                        <thead className="bg-[var(--surface-strong)] text-[var(--text-muted)]">
                          <tr>
                            <th className="px-3 py-2">School</th>
                            <th className="px-3 py-2">Submitted</th>
                            <th className="px-3 py-2">Approved</th>
                            <th className="px-3 py-2">In Print Queue</th>
                            <th className="px-3 py-2">Printed</th>
                            <th className="px-3 py-2">Delivered</th>
                            <th className="px-3 py-2">Rejected</th>
                            <th className="px-3 py-2">Revenue</th>
                            <th className="px-3 py-2">Completion %</th>
                            <th className="px-3 py-2">Drill</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reports.rows.map((r) => (
                            <tr key={r.schoolId} className="border-t border-[var(--line-soft)]">
                              <td className="px-3 py-2">{r.schoolName}</td>
                              <td className="px-3 py-2">{fmtInt(r.submitted)}</td>
                              <td className="px-3 py-2">{fmtInt(r.approved)}</td>
                              <td className="px-3 py-2">{fmtInt(r.inPrint)}</td>
                              <td className="px-3 py-2">{fmtInt(r.printed)}</td>
                              <td className="px-3 py-2">{fmtInt(r.delivered)}</td>
                              <td className="px-3 py-2">{fmtInt(r.rejected)}</td>
                              <td className="px-3 py-2">INR {fmtMoney(r.revenueInr)}</td>
                              <td className="px-3 py-2">{r.completionPercent}%</td>
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  onClick={() => void openSchoolDetail(r.schoolId)}
                                  className="hover-glow rounded-lg border border-[var(--line-soft)] px-2 py-1 text-[11px]"
                                >
                                  Open
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState text="No report rows for selected range." />
                  )}
                </article>
              ) : null}

              {moduleKey === "billing" ? (
                <section className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
                  <article className="glass p-4 xl:col-span-2">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="m-0 text-sm font-semibold">Billing Reconciliation</p>
                      <button
                        type="button"
                        onClick={() => void loadBillingSummary()}
                        className="rounded-xl border border-[var(--line-soft)] px-3 py-2 text-xs hover-glow"
                      >
                        Reload
                      </button>
                    </div>
                    {loading.billingSummary ? (
                      <Skeleton className="h-44 rounded-xl" />
                    ) : billingSummary ? (
                      <div className="space-y-3">
                        <div className="grid gap-2 md:grid-cols-6">
                          <MiniStat label="Invoices" value={fmtInt(billingSummary.totals.invoiceCount)} />
                          <MiniStat label="Invoiced" value={`INR ${fmtMoney(billingSummary.totals.invoiced)}`} />
                          <MiniStat label="Collected" value={`INR ${fmtMoney(billingSummary.totals.collected)}`} />
                          <MiniStat label="Outstanding" value={`INR ${fmtMoney(billingSummary.totals.outstanding)}`} />
                          <MiniStat label="Overdue" value={`INR ${fmtMoney(billingSummary.totals.overdue)}`} />
                          <MiniStat label="Overdue Count" value={fmtInt(billingSummary.totals.overdueCount)} />
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-xl border border-[var(--line-soft)]">
                            <div className="border-b border-[var(--line-soft)] px-3 py-2 text-xs font-semibold">
                              Aging Buckets
                            </div>
                            <table className="w-full text-left text-xs">
                              <thead className="bg-[var(--surface-strong)] text-[var(--text-muted)]">
                                <tr>
                                  <th className="px-3 py-2">Bucket</th>
                                  <th className="px-3 py-2">Count</th>
                                  <th className="px-3 py-2">Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {billingSummary.aging.map((bucket) => (
                                  <tr key={bucket.bucket} className="border-t border-[var(--line-soft)]">
                                    <td className="px-3 py-2">{bucket.bucket}</td>
                                    <td className="px-3 py-2">{fmtInt(bucket.count)}</td>
                                    <td className="px-3 py-2">INR {fmtMoney(bucket.amount)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="rounded-xl border border-[var(--line-soft)]">
                            <div className="border-b border-[var(--line-soft)] px-3 py-2 text-xs font-semibold">
                              Status Breakdown
                            </div>
                            <table className="w-full text-left text-xs">
                              <thead className="bg-[var(--surface-strong)] text-[var(--text-muted)]">
                                <tr>
                                  <th className="px-3 py-2">Status</th>
                                  <th className="px-3 py-2">Count</th>
                                  <th className="px-3 py-2">Outstanding</th>
                                </tr>
                              </thead>
                              <tbody>
                                {billingSummary.byStatus.map((row) => (
                                  <tr key={row.status} className="border-t border-[var(--line-soft)]">
                                    <td className="px-3 py-2">{row.status}</td>
                                    <td className="px-3 py-2">{fmtInt(row.count)}</td>
                                    <td className="px-3 py-2">INR {fmtMoney(row.outstanding)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <EmptyState text="No billing reconciliation data for selected range." />
                    )}
                  </article>

                  <article className="glass p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="m-0 text-sm font-semibold">Invoices</p>
                      <button
                        type="button"
                        onClick={() => {
                          void loadInvoices();
                          void loadBillingSummary();
                        }}
                        className="rounded-xl border border-[var(--line-soft)] px-3 py-2 text-xs hover-glow"
                      >
                        Reload
                      </button>
                    </div>
                    {loading.invoices ? (
                      <Skeleton className="h-72 rounded-xl" />
                    ) : invoices.length ? (
                      <div className="overflow-auto rounded-xl border border-[var(--line-soft)]">
                        <table className="w-full min-w-[840px] text-left text-xs">
                          <thead className="bg-[var(--surface-strong)] text-[var(--text-muted)]">
                            <tr>
                              <th className="px-3 py-2">Invoice</th>
                              <th className="px-3 py-2">School</th>
                              <th className="px-3 py-2">Status</th>
                              <th className="px-3 py-2">Total</th>
                              <th className="px-3 py-2">Paid</th>
                              <th className="px-3 py-2">Issued</th>
                              <th className="px-3 py-2">Due</th>
                            </tr>
                          </thead>
                          <tbody>
                            {invoices.map((row) => (
                              <tr key={row.id} className="border-t border-[var(--line-soft)]">
                                <td className="px-3 py-2">{row.invoiceNo}</td>
                                <td className="px-3 py-2">{row.school?.name || "--"}</td>
                                <td className="px-3 py-2">{row.status}</td>
                                <td className="px-3 py-2">INR {fmtMoney(row.totalAmount)}</td>
                                <td className="px-3 py-2">INR {fmtMoney(row.amountPaid)}</td>
                                <td className="px-3 py-2">{formatDate(row.issuedAt)}</td>
                                <td className="px-3 py-2">{row.dueAt ? formatDate(row.dueAt) : "--"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <EmptyState text="No invoices found." />
                    )}
                  </article>

                  <article className="glass p-4">
                    <p className="m-0 mb-3 text-sm font-semibold">Generate Invoice</p>
                    <div className="grid gap-2">
                      <label className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs">
                        <span className="mb-1 block text-[11px] text-[var(--text-muted)]">School</span>
                        <select
                          value={invoiceForm.schoolId}
                          onChange={(e) => setInvoiceForm((p) => ({ ...p, schoolId: e.target.value }))}
                          className="w-full bg-transparent outline-none"
                        >
                          <option value="">Select school</option>
                          {schools.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <InputField label="Amount" value={invoiceForm.amount} onChange={(v) => setInvoiceForm((p) => ({ ...p, amount: v }))} />
                      <InputField label="Tax %" value={invoiceForm.taxPercent} onChange={(v) => setInvoiceForm((p) => ({ ...p, taxPercent: v }))} />
                      <label className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs">
                        <span className="mb-1 block text-[11px] text-[var(--text-muted)]">Due Date</span>
                        <input
                          type="date"
                          value={invoiceForm.dueAt}
                          onChange={(e) => setInvoiceForm((p) => ({ ...p, dueAt: e.target.value }))}
                          className="w-full bg-transparent outline-none"
                        />
                      </label>
                      <InputField label="Notes" value={invoiceForm.notes} onChange={(v) => setInvoiceForm((p) => ({ ...p, notes: v }))} />
                      <button
                        type="button"
                        onClick={() => void submitInvoice()}
                        disabled={loading.createInvoice}
                        className="mt-1 rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {loading.createInvoice ? "Generating..." : "Create Invoice"}
                      </button>
                    </div>
                  </article>
                </section>
              ) : null}

              {moduleKey === "settings" ? (
                <section className="grid gap-4 xl:grid-cols-2">
                  <article className="glass p-4">
                    <p className="m-0 text-sm font-semibold">Appearance</p>
                    <p className="m-0 mt-1 text-xs text-[var(--text-muted)]">
                      Bright white + dark blue in light mode and premium dark mode default.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => applyTheme("dark")}
                        className={`rounded-xl border px-3 py-2 text-xs ${
                          theme === "dark"
                            ? "border-[#0F3C78] bg-[linear-gradient(135deg,rgba(26,44,114,0.22),rgba(28,110,213,0.18))]"
                            : "border-[var(--line-soft)]"
                        }`}
                      >
                        Dark
                      </button>
                      <button
                        type="button"
                        onClick={() => applyTheme("light")}
                        className={`rounded-xl border px-3 py-2 text-xs ${
                          theme === "light"
                            ? "border-[#0F3C78] bg-[linear-gradient(135deg,rgba(26,44,114,0.22),rgba(28,110,213,0.18))]"
                            : "border-[var(--line-soft)]"
                        }`}
                      >
                        Light
                      </button>
                    </div>
                  </article>
                  <article className="glass p-4">
                    <p className="m-0 text-sm font-semibold">Default Filter Presets</p>
                    <p className="m-0 mt-1 text-xs text-[var(--text-muted)]">
                      Current default uses month-to-date range. You can re-apply any time.
                    </p>
                    <button
                      type="button"
                      onClick={() => setFilters(defaultMonthRange())}
                      className="mt-3 rounded-xl border border-[var(--line-soft)] px-3 py-2 text-xs hover-glow"
                    >
                      Reset to MTD
                    </button>
                  </article>

                  <article className="glass p-4 xl:col-span-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="m-0 text-sm font-semibold">Security Retention Controls</p>
                        <p className="m-0 mt-1 text-xs text-[var(--text-muted)]">
                          Review expired OTPs, old reset tokens, stale sessions, and generated artifacts before
                          purging them. Every run is audit logged.
                        </p>
                      </div>
                      <span className="rounded-full border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-1 text-[11px] text-[var(--text-muted)]">
                        {canRunRetentionPurge ? "Purge enabled for your role" : "Summary only for your role"}
                      </span>
                    </div>

                    {canViewRetention ? (
                      <>
                        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                          <InputField
                            label="OTP retention (hours)"
                            value={retentionForm.otpRetentionHours}
                            onChange={(value) =>
                              setRetentionForm((prev) => ({ ...prev, otpRetentionHours: value.replace(/[^\d]/g, "") }))
                            }
                            type="number"
                          />
                          <InputField
                            label="Reset token retention (hours)"
                            value={retentionForm.resetTokenRetentionHours}
                            onChange={(value) =>
                              setRetentionForm((prev) => ({
                                ...prev,
                                resetTokenRetentionHours: value.replace(/[^\d]/g, "")
                              }))
                            }
                            type="number"
                          />
                          <InputField
                            label="Session retention (days)"
                            value={retentionForm.sessionRetentionDays}
                            onChange={(value) =>
                              setRetentionForm((prev) => ({ ...prev, sessionRetentionDays: value.replace(/[^\d]/g, "") }))
                            }
                            type="number"
                          />
                          <InputField
                            label="Artifact retention (days)"
                            value={retentionForm.artifactRetentionDays}
                            onChange={(value) =>
                              setRetentionForm((prev) => ({ ...prev, artifactRetentionDays: value.replace(/[^\d]/g, "") }))
                            }
                            type="number"
                          />
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void loadRetentionSummary({ announce: true })}
                            disabled={loading.retentionSummary || loading.retentionPurge}
                            className="rounded-xl border border-[var(--line-soft)] px-3 py-2 text-xs hover-glow disabled:opacity-50"
                          >
                            {loading.retentionSummary ? "Refreshing..." : "Refresh Summary"}
                          </button>
                          {canRunRetentionPurge ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void runRetentionPurge(true)}
                                disabled={loading.retentionSummary || loading.retentionPurge}
                                className="rounded-xl border border-[#1C6ED5]/40 bg-[#1C6ED5]/10 px-3 py-2 text-xs font-medium text-[#1C6ED5] disabled:opacity-50"
                              >
                                {loading.retentionPurge ? "Working..." : "Dry Run Purge"}
                              </button>
                              <button
                                type="button"
                                onClick={() => void runRetentionPurge(false)}
                                disabled={loading.retentionSummary || loading.retentionPurge}
                                className="rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                              >
                                {loading.retentionPurge ? "Executing..." : "Execute Purge"}
                              </button>
                            </>
                          ) : null}
                        </div>

                        {loading.retentionSummary ? (
                          <Skeleton className="mt-4 h-40 rounded-xl" />
                        ) : retentionSummary ? (
                          <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr,1fr]">
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                              <MiniStat
                                label="Expired OTP Challenges"
                                value={fmtInt(retentionSummary.summary.otpChallenges.expired)}
                              />
                              <MiniStat
                                label="Consumed OTP Challenges"
                                value={fmtInt(retentionSummary.summary.otpChallenges.consumed)}
                              />
                              <MiniStat
                                label="Expired Reset Tokens"
                                value={fmtInt(retentionSummary.summary.resetTokens.expired)}
                              />
                              <MiniStat
                                label="Used Reset Tokens"
                                value={fmtInt(retentionSummary.summary.resetTokens.used)}
                              />
                              <MiniStat
                                label="Expired Sessions"
                                value={fmtInt(retentionSummary.summary.authSessions.expired)}
                              />
                              <MiniStat
                                label="Revoked Sessions"
                                value={fmtInt(retentionSummary.summary.authSessions.revoked)}
                              />
                              <MiniStat
                                label="Render Batch Artifacts"
                                value={fmtInt(retentionSummary.summary.generatedArtifacts.renderBatches)}
                              />
                              <MiniStat
                                label="Print Job Artifacts"
                                value={fmtInt(retentionSummary.summary.generatedArtifacts.printJobs)}
                              />
                            </div>

                            <div className="rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-strong)] p-4">
                              <p className="m-0 text-sm font-semibold">Current Policy Snapshot</p>
                              <div className="mt-3 grid gap-2">
                                <MiniStat
                                  label="OTP retention"
                                  value={`${retentionSummary.policy.otpRetentionHours} hours`}
                                />
                                <MiniStat
                                  label="Reset token retention"
                                  value={`${retentionSummary.policy.resetTokenRetentionHours} hours`}
                                />
                                <MiniStat
                                  label="Session retention"
                                  value={`${retentionSummary.policy.sessionRetentionDays} days`}
                                />
                                <MiniStat
                                  label="Artifact retention"
                                  value={`${retentionSummary.policy.artifactRetentionDays} days`}
                                />
                                <MiniStat
                                  label="Total generated artifacts queued"
                                  value={fmtInt(retentionSummary.summary.generatedArtifacts.total)}
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <EmptyState text="Retention summary not loaded yet." />
                        )}

                        {retentionResult ? (
                          <div className="mt-4 rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-strong)] p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="m-0 text-sm font-semibold">
                                  Latest retention run: {retentionResult.dryRun ? "Dry run" : "Executed purge"}
                                </p>
                                <p className="m-0 mt-1 text-xs text-[var(--text-muted)]">
                                  This result reflects the last retention action from this session.
                                </p>
                              </div>
                              <span className="rounded-full border border-[var(--line-soft)] px-3 py-1 text-[11px] text-[var(--text-muted)]">
                                Files deleted: {fmtInt(retentionResult.counts.generatedArtifacts.filesDeleted)}
                              </span>
                            </div>
                            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                              <MiniStat
                                label="OTP artifacts touched"
                                value={fmtInt(
                                  retentionResult.counts.otpChallenges.expired +
                                    retentionResult.counts.otpChallenges.consumed
                                )}
                              />
                              <MiniStat
                                label="Reset token artifacts touched"
                                value={fmtInt(
                                  retentionResult.counts.resetTokens.expired +
                                    retentionResult.counts.resetTokens.used
                                )}
                              />
                              <MiniStat
                                label="Sessions touched"
                                value={fmtInt(
                                  retentionResult.counts.authSessions.expired +
                                    retentionResult.counts.authSessions.revoked
                                )}
                              />
                              <MiniStat
                                label="Generated artifacts touched"
                                value={fmtInt(
                                  retentionResult.counts.generatedArtifacts.renderBatches +
                                    retentionResult.counts.generatedArtifacts.printJobs
                                )}
                              />
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="mt-4">
                        <EmptyState text="Your role does not have access to security retention controls." />
                      </div>
                    )}
                  </article>

                  <article className="glass p-4 xl:col-span-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="m-0 text-sm font-semibold">Auth Anomaly Watch</p>
                        <p className="m-0 mt-1 text-xs text-[var(--text-muted)]">
                          Monitor repeated failed logins, OTP activity, and quickly revoke user sessions when
                          something looks wrong.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          void Promise.all([loadAuthAnomalies(), loadSecurityEvents()]);
                        }}
                        disabled={
                          !canViewSecurityOperations ||
                          loading.authAnomalies ||
                          loading.securityEvents ||
                          loading.revokeSessions
                        }
                        className="rounded-xl border border-[var(--line-soft)] px-3 py-2 text-xs hover-glow disabled:opacity-50"
                      >
                        {loading.authAnomalies || loading.securityEvents ? "Refreshing..." : "Refresh Feed"}
                      </button>
                    </div>

                    {canViewSecurityOperations ? (
                      <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr,0.85fr]">
                        <div className="space-y-4">
                          <div className="rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-strong)] p-4">
                            <div className="flex items-center justify-between gap-2">
                              <p className="m-0 text-sm font-semibold">Hot IPs</p>
                              <span className="text-[11px] text-[var(--text-muted)]">Last 60 security events</span>
                            </div>
                            {loading.authAnomalies ? (
                              <Skeleton className="mt-3 h-32 rounded-xl" />
                            ) : authAnomalies?.hotIps?.length ? (
                              <div className="mt-3 grid gap-2 md:grid-cols-2">
                                {authAnomalies.hotIps.map((row) => (
                                  <div
                                    key={row.ip}
                                    className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface)] px-3 py-2"
                                  >
                                    <p className="m-0 text-xs font-semibold">{row.ip}</p>
                                    <p className="m-0 mt-1 text-[11px] text-[var(--text-muted)]">
                                      Failed logins: {fmtInt(row.count)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="mt-3">
                                <EmptyState text="No hot IPs detected in the recent auth stream." />
                              </div>
                            )}
                          </div>

                          <div className="rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-strong)] p-4">
                            <p className="m-0 text-sm font-semibold">Recent Security Events</p>
                            {loading.authAnomalies ? (
                              <Skeleton className="mt-3 h-48 rounded-xl" />
                            ) : authAnomalies?.recent?.length ? (
                              <div className="mt-3 overflow-auto rounded-xl border border-[var(--line-soft)]">
                                <table className="w-full min-w-[760px] text-left text-xs">
                                  <thead className="bg-[var(--surface)] text-[var(--text-muted)]">
                                    <tr>
                                      <th className="px-3 py-2">Time</th>
                                      <th className="px-3 py-2">Action</th>
                                      <th className="px-3 py-2">IP</th>
                                      <th className="px-3 py-2">Actor</th>
                                      <th className="px-3 py-2">Role</th>
                                      <th className="px-3 py-2">Target</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {authAnomalies.recent.map((row) => (
                                      <tr key={row.id} className="border-t border-[var(--line-soft)]">
                                        <td className="px-3 py-2">{new Date(row.createdAt).toLocaleString()}</td>
                                        <td className="px-3 py-2">{row.action}</td>
                                        <td className="px-3 py-2">{row.ipAddress || "--"}</td>
                                        <td className="px-3 py-2">{row.actorUser?.email || "--"}</td>
                                        <td className="px-3 py-2">{row.actorUser?.role || "--"}</td>
                                        <td className="px-3 py-2">{row.entityId || "--"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="mt-3">
                                <EmptyState text="No auth anomalies recorded yet." />
                              </div>
                            )}
                          </div>

                          <div className="rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-strong)] p-4">
                            <div className="flex items-center justify-between gap-2">
                              <p className="m-0 text-sm font-semibold">Protected Downloads & Export Trail</p>
                              <span className="text-[11px] text-[var(--text-muted)]">
                                Access denials, exports, downloads, retention runs
                              </span>
                            </div>
                            {loading.securityEvents ? (
                              <Skeleton className="mt-3 h-48 rounded-xl" />
                            ) : securityEvents?.recent?.length ? (
                              <>
                                {securityEvents.actionCounts?.length ? (
                                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                                    {securityEvents.actionCounts.map((row) => (
                                      <span
                                        key={row.action}
                                        className="rounded-full border border-[var(--line-soft)] px-3 py-1 text-[var(--text-muted)]"
                                      >
                                        {row.action}: {fmtInt(row.count)}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                                <div className="mt-3 overflow-auto rounded-xl border border-[var(--line-soft)]">
                                  <table className="w-full min-w-[760px] text-left text-xs">
                                    <thead className="bg-[var(--surface)] text-[var(--text-muted)]">
                                      <tr>
                                        <th className="px-3 py-2">Time</th>
                                        <th className="px-3 py-2">Action</th>
                                        <th className="px-3 py-2">Entity</th>
                                        <th className="px-3 py-2">IP</th>
                                        <th className="px-3 py-2">Actor</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {securityEvents.recent.map((row) => (
                                        <tr key={row.id} className="border-t border-[var(--line-soft)]">
                                          <td className="px-3 py-2">{new Date(row.createdAt).toLocaleString()}</td>
                                          <td className="px-3 py-2">{row.action}</td>
                                          <td className="px-3 py-2">
                                            {[row.entityType, row.entityId].filter(Boolean).join(" • ") || "--"}
                                          </td>
                                          <td className="px-3 py-2">{row.ipAddress || "--"}</td>
                                          <td className="px-3 py-2">{row.actorUser?.email || "--"}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </>
                            ) : (
                              <div className="mt-3">
                                <EmptyState text="No protected download or export events recorded yet." />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-strong)] p-4">
                          <p className="m-0 text-sm font-semibold">Revoke User Sessions</p>
                          <p className="m-0 mt-1 text-xs text-[var(--text-muted)]">
                            Use this when a user device is compromised, a browser is shared, or credentials were
                            exposed. This action is audit logged.
                          </p>
                          <div className="mt-3 grid gap-3">
                            <label className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface)] px-3 py-2 text-xs">
                              <span className="mb-1 block text-[11px] text-[var(--text-muted)]">User</span>
                              <select
                                value={revokeUserId}
                                onChange={(e) => setRevokeUserId(e.target.value)}
                                className="w-full bg-transparent outline-none"
                              >
                                <option value="">Select user</option>
                                {securityManagedUsers.map((user) => (
                                  <option key={user.id} value={user.id}>
                                    {(user.name?.trim() || user.email)} • {user.role}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex items-center gap-2 rounded-xl border border-[var(--line-soft)] bg-[var(--surface)] px-3 py-2 text-xs">
                              <input
                                type="checkbox"
                                checked={revokeMfa}
                                onChange={(e) => setRevokeMfa(e.target.checked)}
                              />
                              Disable MFA on this user as part of the security reset
                            </label>
                            <button
                              type="button"
                              onClick={() => void revokeSelectedUserSessions()}
                              disabled={!canRevokeSessions || loading.revokeSessions || !revokeUserId}
                              className="rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              {loading.revokeSessions ? "Revoking..." : "Revoke Active Sessions"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4">
                        <EmptyState text="Your role does not have access to auth anomaly operations." />
                      </div>
                    )}
                  </article>

                  <article className="glass p-4 xl:col-span-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="m-0 text-sm font-semibold">Field Masking Policies</p>
                        <p className="m-0 mt-1 text-xs text-[var(--text-muted)]">
                          Define which roles can view sensitive fields per school and how those fields should be
                          masked by default.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void loadMaskPolicies(securitySchoolId)}
                        disabled={!canViewSecurityOperations || !securitySchoolId || loading.maskPolicies}
                        className="rounded-xl border border-[var(--line-soft)] px-3 py-2 text-xs hover-glow disabled:opacity-50"
                      >
                        {loading.maskPolicies ? "Refreshing..." : "Refresh Policies"}
                      </button>
                    </div>

                    {canViewSecurityOperations ? (
                      <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr,1.1fr]">
                        <div className="rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-strong)] p-4">
                          <p className="m-0 text-sm font-semibold">Create / Update Policy</p>
                          <div className="mt-3 grid gap-3">
                            <label className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface)] px-3 py-2 text-xs">
                              <span className="mb-1 block text-[11px] text-[var(--text-muted)]">School</span>
                              <select
                                value={securitySchoolId}
                                onChange={(e) => setSecuritySchoolId(e.target.value)}
                                className="w-full bg-transparent outline-none"
                              >
                                <option value="">Select school</option>
                                {schools.map((school) => (
                                  <option key={school.id} value={school.id}>
                                    {school.name} ({school.code})
                                  </option>
                                ))}
                              </select>
                            </label>
                            <InputField
                              label="Field key"
                              value={maskPolicyForm.fieldKey}
                              onChange={(value) => setMaskPolicyForm((prev) => ({ ...prev, fieldKey: value }))}
                            />
                            <InputField
                              label="Allowed roles (comma separated)"
                              value={maskPolicyForm.rolesAllowed}
                              onChange={(value) => setMaskPolicyForm((prev) => ({ ...prev, rolesAllowed: value }))}
                            />
                            <label className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface)] px-3 py-2 text-xs">
                              <span className="mb-1 block text-[11px] text-[var(--text-muted)]">Mask strategy</span>
                              <select
                                value={maskPolicyForm.maskStrategy}
                                onChange={(e) =>
                                  setMaskPolicyForm((prev) => ({ ...prev, maskStrategy: e.target.value }))
                                }
                                className="w-full bg-transparent outline-none"
                              >
                                <option value="PARTIAL">PARTIAL</option>
                                <option value="LAST4">LAST4</option>
                                <option value="FULL">FULL</option>
                              </select>
                            </label>
                            <label className="flex items-center gap-2 rounded-xl border border-[var(--line-soft)] bg-[var(--surface)] px-3 py-2 text-xs">
                              <input
                                type="checkbox"
                                checked={maskPolicyForm.isActive}
                                onChange={(e) =>
                                  setMaskPolicyForm((prev) => ({ ...prev, isActive: e.target.checked }))
                                }
                              />
                              Policy is active
                            </label>
                            <button
                              type="button"
                              onClick={() => void submitMaskPolicy()}
                              disabled={!canManageMaskPolicies || loading.upsertMaskPolicy || !securitySchoolId}
                              className="rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              {loading.upsertMaskPolicy ? "Saving..." : "Save Mask Policy"}
                            </button>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-strong)] p-4">
                          <p className="m-0 text-sm font-semibold">Active Policies</p>
                          {loading.maskPolicies ? (
                            <Skeleton className="mt-3 h-56 rounded-xl" />
                          ) : maskPolicies.length ? (
                            <div className="mt-3 overflow-auto rounded-xl border border-[var(--line-soft)]">
                              <table className="w-full min-w-[720px] text-left text-xs">
                                <thead className="bg-[var(--surface)] text-[var(--text-muted)]">
                                  <tr>
                                    <th className="px-3 py-2">Field</th>
                                    <th className="px-3 py-2">Mask</th>
                                    <th className="px-3 py-2">Roles</th>
                                    <th className="px-3 py-2">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {maskPolicies.map((policy) => (
                                    <tr key={policy.id} className="border-t border-[var(--line-soft)]">
                                      <td className="px-3 py-2 font-medium">{policy.fieldKey}</td>
                                      <td className="px-3 py-2">{policy.maskStrategy}</td>
                                      <td className="px-3 py-2">{policy.rolesAllowed.join(", ")}</td>
                                      <td className="px-3 py-2">{policy.isActive ? "ACTIVE" : "INACTIVE"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="mt-3">
                              <EmptyState text="No masking policies found for the selected school." />
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4">
                        <EmptyState text="Your role does not have access to mask policy operations." />
                      </div>
                    )}
                  </article>
                </section>
              ) : null}

              {moduleKey === "audit-logs" ? (
                <article className="glass p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="m-0 text-sm font-semibold">Audit Logs</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <InputCompact label="Entity" value={auditEntityType} onChange={setAuditEntityType} />
                      <InputCompact label="Actor User Id" value={auditActorId} onChange={setAuditActorId} />
                      <button
                        type="button"
                        onClick={() => {
                          setAuditPage(1);
                          void loadAuditLogs(1);
                        }}
                        className="rounded-xl border border-[var(--line-soft)] px-3 py-2 text-xs hover-glow"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                  {loading.audit ? (
                    <Skeleton className="h-72 rounded-xl" />
                  ) : auditRows.length ? (
                    <>
                      <div className="overflow-auto rounded-xl border border-[var(--line-soft)]">
                        <table className="w-full min-w-[980px] text-left text-xs">
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
                            {auditRows.map((r) => (
                              <tr key={r.id} className="border-t border-[var(--line-soft)]">
                                <td className="px-3 py-2">{new Date(r.createdAt).toLocaleString()}</td>
                                <td className="px-3 py-2">{r.entityType}</td>
                                <td className="px-3 py-2">{r.entityId}</td>
                                <td className="px-3 py-2">{r.action}</td>
                                <td className="px-3 py-2">{r.actorUser?.email || "--"}</td>
                                <td className="px-3 py-2">{r.actorUser?.role || "--"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-[var(--text-muted)]">
                        <p className="m-0">
                          Showing {(auditPage - 1) * auditPageSize + 1} -{" "}
                          {Math.min(auditPage * auditPageSize, auditTotal)} of {auditTotal}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                            disabled={auditPage <= 1}
                            className="rounded-lg border border-[var(--line-soft)] px-3 py-1 disabled:opacity-40"
                          >
                            Prev
                          </button>
                          <span>Page {auditPage}</span>
                          <button
                            type="button"
                            onClick={() => setAuditPage((p) => p + 1)}
                            disabled={auditPage * auditPageSize >= auditTotal}
                            className="rounded-lg border border-[var(--line-soft)] px-3 py-1 disabled:opacity-40"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <EmptyState text="No audit rows for selected filters." />
                  )}
                </article>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </section>
      </div>

      <AnimatePresence>
        {drilldown.open ? (
          <Modal onClose={() => setDrilldown((p) => ({ ...p, open: false }))}>
            <div className="mb-3 flex items-center justify-between">
              <p className="m-0 text-sm font-semibold">
                Drilldown: {drilldown.metric.toUpperCase()} ({drilldown.date})
              </p>
              <button
                type="button"
                onClick={() => setDrilldown((p) => ({ ...p, open: false }))}
                className="rounded-lg border border-[var(--line-soft)] p-1"
              >
                <X size={14} />
              </button>
            </div>
            {drilldown.loading ? (
              <Skeleton className="h-56 rounded-xl" />
            ) : drilldown.error ? (
              <p className="text-xs text-rose-300">{drilldown.error}</p>
            ) : drilldown.rows.length ? (
              <div className="overflow-auto rounded-xl border border-[var(--line-soft)]">
                <table className="w-full min-w-[680px] text-left text-xs">
                  <thead className="bg-[var(--surface-strong)] text-[var(--text-muted)]">
                    <tr>
                      <th className="px-3 py-2">School</th>
                      <th className="px-3 py-2">Sales Person</th>
                      <th className="px-3 py-2">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drilldown.rows.map((r) => (
                      <tr key={`${r.schoolId}-${r.value}`} className="border-t border-[var(--line-soft)]">
                        <td className="px-3 py-2">{r.schoolName}</td>
                        <td className="px-3 py-2">{r.salesOwnerName}</td>
                        <td className="px-3 py-2">
                          {drilldown.metric === "revenue" ? `INR ${fmtMoney(r.value)}` : fmtInt(r.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                text={
                  drilldown.metric === "pending_approvals"
                    ? "No pending approval contributors found for selected date."
                    : "No contributors for selected point."
                }
              />
            )}
          </Modal>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {detailModalOpen ? (
          <Modal onClose={() => setDetailModalOpen(false)} wide>
            {detailLoading ? (
              <Skeleton className="h-72 rounded-xl" />
            ) : detailData && detailDraft ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="m-0 text-lg font-semibold">{detailData.school.name}</p>
                    <p className="m-0 mt-1 text-xs text-[var(--text-muted)]">
                      {detailData.school.code} â€¢ Created {formatDate(detailData.school.createdAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailModalOpen(false)}
                    className="rounded-lg border border-[var(--line-soft)] p-1"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="grid gap-2 md:grid-cols-4">
                  <MiniStat label="Total Students" value={fmtInt(detailData.stats.totalStudents)} />
                  <MiniStat label="Parents" value={fmtInt(detailData.stats.parents)} />
                  <MiniStat label="Intake Links" value={fmtInt(detailData.stats.intakeLinks)} />
                  <MiniStat label="Invoice Total" value={`INR ${fmtMoney(detailData.stats.invoiceTotal)}`} />
                </div>

                <div className="grid gap-2 md:grid-cols-3">
                  <InputField label="School Name" value={detailDraft.name} onChange={(v) => setDetailDraft((p) => (p ? { ...p, name: v } : p))} />
                  <InputField label="Email" value={detailDraft.email} onChange={(v) => setDetailDraft((p) => (p ? { ...p, email: v } : p))} />
                  <InputField label="Phone" value={detailDraft.phone} onChange={(v) => setDetailDraft((p) => (p ? { ...p, phone: v } : p))} />
                  <InputField label="City" value={detailDraft.city} onChange={(v) => setDetailDraft((p) => (p ? { ...p, city: v } : p))} />
                  <InputField label="State" value={detailDraft.state} onChange={(v) => setDetailDraft((p) => (p ? { ...p, state: v } : p))} />
                  <label className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs">
                    <span className="mb-1 block text-[11px] text-[var(--text-muted)]">Status</span>
                    <select
                      value={detailDraft.status}
                      onChange={(e) =>
                        setDetailDraft((p) => (p ? { ...p, status: e.target.value as SchoolStatus } : p))
                      }
                      className="w-full bg-transparent outline-none"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => void saveSchoolDetail()}
                  disabled={savingSchoolDetail}
                  className="rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {savingSchoolDetail ? "Saving..." : "Save School (Audited)"}
                </button>

                <div className="rounded-xl border border-[var(--line-soft)]">
                  <div className="border-b border-[var(--line-soft)] px-3 py-2 text-xs font-semibold">
                    Intake Link Management
                  </div>
                  <div className="grid gap-3 p-3 md:grid-cols-[1.1fr_1fr]">
                    <div className="grid gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <InputField
                          label="Class"
                          value={detailIntakeForm.className}
                          onChange={(v) => setDetailIntakeForm((p) => ({ ...p, className: v }))}
                        />
                        <InputField
                          label="Section"
                          value={detailIntakeForm.section}
                          onChange={(v) => setDetailIntakeForm((p) => ({ ...p, section: v }))}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <InputField
                          label="Max Students"
                          value={detailIntakeForm.maxStudentsPerParent}
                          onChange={(v) =>
                            setDetailIntakeForm((p) => ({ ...p, maxStudentsPerParent: v }))
                          }
                        />
                        <label className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs">
                          <span className="mb-1 block text-[11px] text-[var(--text-muted)]">Photo BG</span>
                          <select
                            value={detailIntakeForm.photoBgPreference}
                            onChange={(e) =>
                              setDetailIntakeForm((p) => ({ ...p, photoBgPreference: e.target.value }))
                            }
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
                            value={detailIntakeForm.expiresAt}
                            onChange={(e) =>
                              setDetailIntakeForm((p) => ({ ...p, expiresAt: e.target.value }))
                            }
                            className="w-full bg-transparent outline-none"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => void createDetailIntakeLink()}
                        disabled={detailCreateLinkLoading}
                        className="rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {detailCreateLinkLoading ? "Creating..." : "Create Intake Link"}
                      </button>
                    </div>
                    <div>
                      {detailIntakeLoading ? (
                        <Skeleton className="h-32 rounded-xl" />
                      ) : detailIntakeLinks.length ? (
                        <div className="max-h-40 space-y-2 overflow-auto">
                          {detailIntakeLinks.map((link) => {
                            const url = `${window.location.origin}/parent/intake?token=${encodeURIComponent(link.token)}`;
                            return (
                              <div
                                key={link.id}
                                className="rounded-lg border border-[var(--line-soft)] px-2 py-2 text-xs"
                              >
                                <p className="m-0 font-medium">
                                  {link.className}-{link.section} â€¢ {link.photoBgPreference}
                                </p>
                                <p className="m-0 mt-1 text-[var(--text-muted)]">{link.token}</p>
                                <p className="m-0 mt-1 text-[var(--text-muted)]">
                                  Expires {formatDate(link.expiresAt)}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => navigator.clipboard.writeText(url)}
                                  className="mt-2 rounded-md border border-[var(--line-soft)] px-2 py-1 text-[11px] hover-glow"
                                >
                                  Copy Parent URL
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <EmptyState text="No intake links for this school." />
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--line-soft)]">
                  <div className="border-b border-[var(--line-soft)] px-3 py-2 text-xs font-semibold">
                    Student Explorer
                  </div>
                  <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line-soft)] px-3 py-2">
                    <input
                      value={detailStudentQuery}
                      onChange={(e) => setDetailStudentQuery(e.target.value)}
                      placeholder="Search by student/parent/roll/mobile"
                      className="rounded-lg border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-1.5 text-xs outline-none"
                    />
                    <select
                      value={detailStudentStatus}
                      onChange={(e) => setDetailStudentStatus(e.target.value as StudentStatus | "")}
                      className="rounded-lg border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-1.5 text-xs outline-none"
                    >
                      <option value="">All status</option>
                      {WORKFLOW_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setDetailStudentsPage(1);
                        if (detailData?.school.id) void loadDetailStudents(detailData.school.id, 1);
                      }}
                      className="rounded-lg border border-[var(--line-soft)] px-3 py-1.5 text-xs hover-glow"
                    >
                      Search
                    </button>
                  </div>
                  {detailStudentsLoading ? (
                    <Skeleton className="m-3 h-40 rounded-xl" />
                  ) : detailStudents?.rows.length ? (
                    <>
                      <div className="overflow-auto">
                        <table className="w-full min-w-[1000px] text-left text-xs">
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
                            {detailStudents.rows.map((s) => (
                              <tr key={s.id} className="border-t border-[var(--line-soft)]">
                                <td className="px-3 py-2">{s.fullName}</td>
                                <td className="px-3 py-2">
                                  {[s.className, s.section].filter(Boolean).join("-") || "--"}
                                </td>
                                <td className="px-3 py-2">
                                  {[s.parentName, s.parentMobile].filter(Boolean).join(" â€¢ ")}
                                </td>
                                <td className="px-3 py-2">{s.status}</td>
                                <td className="px-3 py-2">
                                  <select
                                    value={s.status}
                                    onChange={(e) => void updateStudentStatus(s.id, e.target.value as StudentStatus)}
                                    disabled={savingStudentId === s.id}
                                    className="rounded-lg border border-[var(--line-soft)] bg-[var(--surface-strong)] px-2 py-1 outline-none"
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
                      <div className="flex items-center justify-between border-t border-[var(--line-soft)] px-3 py-2 text-xs text-[var(--text-muted)]">
                        <span>
                          Page {detailStudents.page} â€¢ {fmtInt(detailStudents.total)} records
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDetailStudentsPage((p) => Math.max(1, p - 1))}
                            disabled={detailStudents.page <= 1}
                            className="rounded-md border border-[var(--line-soft)] px-2 py-1 disabled:opacity-40"
                          >
                            Prev
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (detailStudents.page * detailStudents.pageSize < detailStudents.total) {
                                setDetailStudentsPage((p) => p + 1);
                              }
                            }}
                            disabled={detailStudents.page * detailStudents.pageSize >= detailStudents.total}
                            className="rounded-md border border-[var(--line-soft)] px-2 py-1 disabled:opacity-40"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="p-3">
                      <EmptyState text="No students found for selected filter." />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <EmptyState text="School detail not available." />
            )}
          </Modal>
        ) : null}
      </AnimatePresence>
    </main>
  );
}

function KpiTile({
  label,
  value,
  loading,
  asCurrency,
  onClick
}: {
  label: string;
  value: number | null | undefined;
  loading: boolean;
  asCurrency?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="glass hover-glow min-h-[92px] p-4 text-left"
      disabled={!onClick}
    >
      <p className="m-0 text-[11px] text-[var(--text-muted)]">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-6 w-32 rounded-md" />
      ) : (
        <p className="m-0 mt-2 text-2xl font-semibold">
          {asCurrency ? `INR ${fmtMoney(value || 0)}` : fmtInt(value || 0)}
        </p>
      )}
    </button>
  );
}

function TrendCard({
  title,
  subtitle,
  points,
  loading,
  asCurrency,
  onPointClick
}: {
  title: string;
  subtitle: string;
  points: TimePoint[];
  loading: boolean;
  asCurrency?: boolean;
  onPointClick: (date: string) => void;
}) {
  return (
    <article className="glass p-4">
      <p className="m-0 text-sm font-semibold">{title}</p>
      <p className="m-0 mt-1 text-xs text-[var(--text-muted)]">{subtitle}</p>
      <div className="mt-3">
        {loading ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : points.length ? (
          <TrendChart points={points} asCurrency={asCurrency} onPointClick={onPointClick} />
        ) : (
          <EmptyState text="No points in selected date range." />
        )}
      </div>
    </article>
  );
}

function TrendChart({
  points,
  asCurrency,
  onPointClick
}: {
  points: TimePoint[];
  asCurrency?: boolean;
  onPointClick: (date: string) => void;
}) {
  if (!points.length) return null;
  const max = Math.max(...points.map((p) => p.value), 1);
  const len = points.length;
  const normalized = points.map((p, idx) => {
    const x = len <= 1 ? 0 : (idx / (len - 1)) * 100;
    const y = 96 - (p.value / max) * 86;
    return { ...p, x, y };
  });
  const polyline = normalized.map((p) => `${p.x},${p.y}`).join(" ");
  const latest = points[points.length - 1]?.value || 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1">
          <CalendarDays size={12} />
          {formatDate(points[0].date)} - {formatDate(points[points.length - 1].date)}
        </span>
        <span>{asCurrency ? `INR ${fmtMoney(latest)}` : fmtInt(latest)}</span>
      </div>
      <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] p-3">
        <svg viewBox="0 0 100 100" className="h-36 w-full overflow-visible">
          <defs>
            <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(15,60,120,0.38)" />
              <stop offset="100%" stopColor="rgba(28,110,213,0.06)" />
            </linearGradient>
          </defs>
          <polyline fill="none" stroke="rgba(58,141,255,0.95)" strokeWidth="1.8" points={polyline} />
          <polyline
            fill="url(#trendFill)"
            stroke="none"
            points={`0,100 ${polyline} 100,100`}
            opacity={0.95}
          />
          {normalized.map((p) => (
            <circle
              key={`${p.date}-${p.value}`}
              cx={p.x}
              cy={p.y}
              r={2.2}
              fill="rgba(191,219,254,0.95)"
              stroke="rgba(15,60,120,0.9)"
              strokeWidth="0.8"
              className="cursor-pointer"
              onClick={() => onPointClick(p.date)}
            >
              <title>
                {p.date}: {asCurrency ? `INR ${fmtMoney(p.value)}` : fmtInt(p.value)}
              </title>
            </circle>
          ))}
        </svg>
      </div>
      <p className="m-0 text-[11px] text-[var(--text-muted)]">Click any point to open contributor drilldown.</p>
    </div>
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

function InputCompact({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] px-3 py-2 text-xs">
      <span className="mb-1 block text-[11px] text-[var(--text-muted)]">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent outline-none" />
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

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--line-soft)] p-6 text-center text-xs text-[var(--text-muted)]">
      {text}
    </div>
  );
}

function Skeleton({ className }: { className: string }) {
  return <div className={`skeleton ${className}`} />;
}

function Modal({
  children,
  onClose,
  wide
}: {
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        className={`glass max-h-[90vh] w-full overflow-auto p-4 ${wide ? "max-w-6xl" : "max-w-3xl"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function OrbLoader({ theme }: { theme: ThemeMode }) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden">
      <motion.div
        className="absolute h-[28rem] w-[28rem] rounded-full bg-[#0F3C78]/30 blur-3xl"
        animate={{ x: [0, 30, -20, 0], y: [0, -24, 12, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute h-[24rem] w-[24rem] rounded-full bg-[#1C6ED5]/24 blur-3xl"
        animate={{ x: [0, -24, 20, 0], y: [0, 20, -12, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        animate={{ rotateY: [0, 180, 360], rotateX: [0, 12, 0] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "linear" }}
        className={`relative h-20 w-20 rounded-[22px] border ${
          theme === "light" ? "border-[#0F3C78]/40 bg-white/90" : "border-white/20 bg-white/10"
        } shadow-[0_0_60px_rgba(15,60,120,0.35)]`}
      />
      <p className="absolute bottom-[18%] m-0 text-xs text-[var(--text-muted)]">Loading enterprise workspace...</p>
    </main>
  );
}

function defaultMonthRange(): OverviewFilters {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    start: toISODate(start),
    end: toISODate(now),
    salesOwnerId: "",
    region: "",
    status: ""
  };
}

function toISODate(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function fmtInt(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0);
}

function fmtMoney(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value || 0);
}

function formatDate(dateIso: string) {
  return new Date(dateIso).toLocaleDateString();
}






