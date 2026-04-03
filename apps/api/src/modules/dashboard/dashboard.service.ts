import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthenticatedUser } from "../../common/auth/auth-user.type";
import { hasGlobalTenantAccess, isSalesRole, isSchoolRole, normalizeRole } from "../../common/auth/role.utils";
import { Role } from "../../common/enums/role.enum";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(user: AuthenticatedUser) {
    if (isSchoolRole(user.normalizedRole) && user.schoolId) {
      const [submitted, approved, rejected] = await Promise.all([
        this.prisma.student.count({ where: { schoolId: user.schoolId, status: "SUBMITTED" } }),
        this.prisma.student.count({ where: { schoolId: user.schoolId, status: "SCHOOL_APPROVED" } }),
        this.prisma.student.count({ where: { schoolId: user.schoolId, status: "REJECTED" } })
      ]);
      return { role: user.role, submitted, approved, rejected };
    }

    if (normalizeRole(user.normalizedRole) === Role.PRINTING) {
      const [ready, printing, printed] = await Promise.all([
        this.prisma.printJob.count({ where: { status: "READY_FOR_PRINT" } }),
        this.prisma.printJob.count({ where: { status: "PRINTING" } }),
        this.prisma.printJob.count({ where: { status: "PRINTED" } })
      ]);
      return { role: user.role, ready, printing, printed };
    }

    if (isSalesRole(user.normalizedRole)) {
      const schoolIds = user.assignedSchoolIds.length ? user.assignedSchoolIds : ["__none__"];
      const [schools, students, invoices, printJobs] = await Promise.all([
        this.prisma.school.count({ where: { id: { in: schoolIds }, deletedAt: null } }),
        this.prisma.student.count({ where: { schoolId: { in: schoolIds }, deletedAt: null } }),
        this.prisma.invoice.count({ where: { schoolId: { in: schoolIds } } }),
        this.prisma.printJob.count({ where: { schoolId: { in: schoolIds } } })
      ]);
      return { role: user.role, schools, students, invoices, printJobs };
    }

    if (!hasGlobalTenantAccess(user.normalizedRole)) {
      return { role: user.role, schools: 0, students: 0, invoices: 0, printJobs: 0 };
    }

    const [schools, students, invoices, printJobs] = await Promise.all([
      this.prisma.school.count({ where: { deletedAt: null } }),
      this.prisma.student.count({ where: { deletedAt: null } }),
      this.prisma.invoice.count(),
      this.prisma.printJob.count()
    ]);
    return { role: user.role, schools, students, invoices, printJobs };
  }
}
