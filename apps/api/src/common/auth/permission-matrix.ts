import { Role } from "../enums/role.enum";
import { normalizeRole } from "./role.utils";

const permissionMatrix: Record<Role, string[]> = {
  [Role.SUPER_ADMIN]: [
    "overview.read",
    "schools.read",
    "schools.write",
    "users.read",
    "users.write",
    "assignments.read",
    "assignments.write",
    "workflow.read",
    "workflow.write",
    "print.read",
    "print.write",
    "reports.read",
    "billing.read",
    "billing.write",
    "audit.read",
    "settings.write"
  ],
  [Role.COMPANY_ADMIN]: [
    "overview.read",
    "schools.read",
    "schools.write",
    "users.read",
    "users.write",
    "assignments.read",
    "assignments.write",
    "workflow.read",
    "workflow.write",
    "print.read",
    "reports.read",
    "billing.read",
    "audit.read"
  ],
  [Role.SALES_PERSON]: [
    "overview.read",
    "schools.read",
    "schools.write",
    "workflow.read",
    "workflow.write",
    "reports.read",
    "billing.read",
    "billing.write",
    "assignments.read"
  ],
  [Role.OPERATIONS_ADMIN]: [],
  [Role.HR_ADMIN]: ["users.read", "users.write", "reports.read", "audit.read"],
  [Role.SALES]: [],
  [Role.PRINTING]: ["print.read", "print.write", "workflow.read"],
  [Role.PRINT_OPS]: ["print.read", "print.write", "workflow.read"],
  [Role.HR]: ["users.read", "reports.read"],
  [Role.FINANCE]: ["billing.read", "reports.read", "overview.read"],
  [Role.SUPPORT]: ["schools.read", "workflow.read", "reports.read"],
  [Role.SCHOOL_ADMIN]: ["school.dashboard.read", "school.users.write", "workflow.read", "workflow.write"],
  [Role.SCHOOL_STAFF]: ["school.dashboard.read", "workflow.read"],
  [Role.PARENT]: ["parent.portal.read", "parent.submissions.write"]
};

export function getPermissionsForRole(role?: Role | string | null): string[] {
  const normalized = normalizeRole(role);
  if (!normalized) return [];
  const perms = permissionMatrix[normalized] ?? [];
  return [...perms];
}
