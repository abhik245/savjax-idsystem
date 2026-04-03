import { Role } from "../enums/role.enum";

export const ROLE_ALIAS_MAP: Record<string, Role> = {
  [Role.OPERATIONS_ADMIN]: Role.COMPANY_ADMIN,
  [Role.SALES]: Role.SALES_PERSON
};

export function normalizeRole(role?: Role | string | null): Role | undefined {
  if (!role) return undefined;
  return ROLE_ALIAS_MAP[role] ?? (role as Role);
}

export function isSuperAdminRole(role?: Role | string | null) {
  return normalizeRole(role) === Role.SUPER_ADMIN;
}

export function isCompanyAdminRole(role?: Role | string | null) {
  const normalized = normalizeRole(role);
  return normalized === Role.COMPANY_ADMIN;
}

export function isSalesRole(role?: Role | string | null) {
  return normalizeRole(role) === Role.SALES_PERSON;
}

export function isSchoolRole(role?: Role | string | null) {
  const normalized = normalizeRole(role);
  return normalized === Role.SCHOOL_ADMIN || normalized === Role.SCHOOL_STAFF;
}

export function isParentRole(role?: Role | string | null) {
  return normalizeRole(role) === Role.PARENT;
}

export function hasGlobalTenantAccess(role?: Role | string | null) {
  const normalized = normalizeRole(role);
  return normalized === Role.SUPER_ADMIN || normalized === Role.COMPANY_ADMIN;
}
