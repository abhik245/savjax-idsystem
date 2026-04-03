import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthenticatedUser } from "../auth/auth-user.type";
import { getPermissionsForRole } from "../auth/permission-matrix";
import {
  hasGlobalTenantAccess,
  isParentRole,
  isSalesRole,
  isSchoolRole,
  normalizeRole
} from "../auth/role.utils";
import { Role } from "../enums/role.enum";

@Injectable()
export class AccessControlService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserScope(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        parent: { select: { id: true } },
        salesAssignments: {
          where: { deletedAt: null },
          select: { schoolId: true }
        },
        schoolAccesses: { select: { schoolId: true } },
        ownedSchools: { where: { deletedAt: null }, select: { id: true } }
      }
    });

    if (!user || user.deletedAt || !user.isActive) {
      throw new UnauthorizedException("User session is not active");
    }
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      throw new UnauthorizedException("Account is temporarily locked");
    }

    const normalizedRole = normalizeRole(user.role) as Role;
    const assignedSchoolIds = new Set<string>();

    if (isSalesRole(normalizedRole)) {
      user.salesAssignments.forEach((assignment) => assignedSchoolIds.add(assignment.schoolId));
      user.ownedSchools.forEach((school) => assignedSchoolIds.add(school.id));
    }
    user.schoolAccesses.forEach((access) => assignedSchoolIds.add(access.schoolId));
    if (user.schoolId) assignedSchoolIds.add(user.schoolId);

    if (isSchoolRole(normalizedRole) && !user.schoolId) {
      throw new UnauthorizedException("School account missing school scope");
    }
    if (isParentRole(normalizedRole) && !user.parent?.id) {
      throw new UnauthorizedException("Parent profile missing");
    }

    return {
      sub: user.id,
      role: user.role as Role,
      normalizedRole,
      schoolId: user.schoolId || undefined,
      parentId: user.parent?.id || undefined,
      assignedSchoolIds: [...assignedSchoolIds],
      permissions: getPermissionsForRole(normalizedRole),
      email: user.email,
      name: user.name
    };
  }

  canAccessSchool(user: Pick<AuthenticatedUser, "normalizedRole" | "schoolId" | "assignedSchoolIds">, schoolId: string) {
    if (!schoolId) return false;
    if (hasGlobalTenantAccess(user.normalizedRole)) return true;
    if (isSalesRole(user.normalizedRole)) return user.assignedSchoolIds.includes(schoolId);
    if (isSchoolRole(user.normalizedRole)) return user.schoolId === schoolId;
    return false;
  }

  assertSchoolAccess(
    user: Pick<AuthenticatedUser, "normalizedRole" | "schoolId" | "assignedSchoolIds">,
    schoolId: string
  ) {
    if (!this.canAccessSchool(user, schoolId)) {
      throw new ForbiddenException("Access denied for the requested school");
    }
  }
}
