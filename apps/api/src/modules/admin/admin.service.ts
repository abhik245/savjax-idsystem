import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  ApprovalRequestStatus,
  ApprovalRequestType,
  ApprovalActionType,
  ApprovalWorkflowStatus,
  CardOrientation,
  InstitutionType,
  IntakeSubmissionStage,
  OrderStatus,
  Prisma,
  RenderBatchItemStatus,
  RenderBatchStatus,
  Role as PrismaRole,
  SchoolStatus,
  StudentStatus,
  TemplateAssignmentScope,
  TemplateCardType,
  TemplateLifecycleStatus
} from "@prisma/client";
import * as bcrypt from "bcrypt";
import { AccessControlService } from "../../common/access/access-control.service";
import { AuthenticatedUser } from "../../common/auth/auth-user.type";
import {
  isCompanyAdminRole,
  isSalesRole,
  isSchoolRole,
  isSuperAdminRole,
  normalizeRole
} from "../../common/auth/role.utils";
import { PrismaService } from "../../prisma/prisma.service";
import { Role } from "../../common/enums/role.enum";
import { FaceIntelligenceService } from "../../common/services/face-intelligence.service";
import { DataProtectionService } from "../../common/services/data-protection.service";
import { TemplateRenderService } from "../../common/services/template-render.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { CreateSchoolUserDto } from "./dto/create-school-user.dto";
import { DispatchPrintDto } from "./dto/dispatch-print.dto";
import { UpsertSalesAssignmentDto } from "./dto/upsert-sales-assignment.dto";
import { UpdateSchoolDto } from "./dto/update-school.dto";
import { UpdateStudentDto } from "./dto/update-student.dto";
import { ApplyCorrectionDto } from "./dto/apply-correction.dto";
import { CreateTemplateDto } from "./dto/create-template.dto";
import { UpdateTemplateMappingDto } from "./dto/update-template-mapping.dto";
import { DuplicateTemplateDto } from "./dto/duplicate-template.dto";
import { MergeDuplicateDto } from "./dto/merge-duplicate.dto";
import { ReplaceStudentPhotoDto } from "./dto/replace-student-photo.dto";
import { HandoffStudentDto } from "./dto/handoff-student.dto";
import { ValidateStudentDto } from "./dto/validate-student.dto";
import { RenderTemplatePreviewDto } from "./dto/render-template-preview.dto";
import { BindTemplateCampaignDto } from "./dto/bind-template-campaign.dto";
import { RebindTemplateProofsDto } from "./dto/rebind-template-proofs.dto";
import { ActivateTemplateDto } from "./dto/activate-template.dto";
import { UpdateTemplateStatusDto } from "./dto/update-template-status.dto";
import { UpsertTemplateAssignmentDto } from "./dto/upsert-template-assignment.dto";
import { CreateRenderBatchDto } from "./dto/create-render-batch.dto";
import { ExportRenderBatchDto } from "./dto/export-render-batch.dto";
import { CreateApprovalChainDto, CreateApprovalChainStepInput } from "./dto/create-approval-chain.dto";
import { ActivateApprovalChainDto } from "./dto/activate-approval-chain.dto";
import { StartApprovalWorkflowDto } from "./dto/start-approval-workflow.dto";
import { ApprovalWorkflowActionDto } from "./dto/approval-workflow-action.dto";
import { BulkApprovalWorkflowActionDto } from "./dto/bulk-approval-workflow-action.dto";
import { UpdatePrintJobStatusDto } from "./dto/update-print-job-status.dto";
import { GeneratePrintArtifactDto } from "./dto/generate-print-artifact.dto";
import { RequestReissueDto } from "./dto/request-reissue.dto";
import { CreateReprintBatchDto } from "./dto/create-reprint-batch.dto";
import { MarkPrintJobIssuedDto } from "./dto/mark-print-job-issued.dto";
import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
type StudentQuery = { q?: string; status?: StudentStatus; className?: string; page?: number; pageSize?: number };
type ReportQuery = {
  schoolId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: StudentStatus;
};
type AuditLogQuery = { entityType?: string; actorUserId?: string; page?: number; pageSize?: number };
type SchoolAuditLogQuery = { entityType?: string; page?: number; pageSize?: number };
type ReviewQueueQuery = {
  schoolId?: string;
  intakeStage?: IntakeSubmissionStage;
  duplicateOnly?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};
type ApprovalWorkflowQuery = {
  schoolId?: string;
  status?: ApprovalWorkflowStatus;
  studentId?: string;
  chainId?: string;
  page?: number;
  pageSize?: number;
};
type TemplateResolutionInput = {
  intakeLinkId?: string;
  className?: string;
  section?: string;
  cardType?: string;
};

const COMPANY_EMPLOYEE_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.COMPANY_ADMIN,
  Role.SALES_PERSON,
  Role.OPERATIONS_ADMIN,
  Role.HR_ADMIN,
  Role.SALES,
  Role.PRINTING,
  Role.PRINT_OPS,
  Role.HR,
  Role.FINANCE,
  Role.SUPPORT
];
const COMPANY_EMPLOYEE_ROLE_SET = new Set<Role>(COMPANY_EMPLOYEE_ROLES);
const APPROVAL_STEP_ROLE_SET = new Set<Role>([
  Role.SUPER_ADMIN,
  Role.COMPANY_ADMIN,
  Role.OPERATIONS_ADMIN,
  Role.SALES_PERSON,
  Role.SALES,
  Role.SCHOOL_ADMIN,
  Role.SCHOOL_STAFF,
  Role.PRINTING,
  Role.PRINT_OPS
]);

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControlService: AccessControlService,
    private readonly faceIntelligenceService: FaceIntelligenceService,
    private readonly dataProtectionService: DataProtectionService,
    private readonly templateRenderService: TemplateRenderService
  ) {}

  async listUsers(actor: AuthenticatedUser, query?: string, role?: Role) {
    if (isSchoolRole(actor.normalizedRole)) {
      throw new ForbiddenException("School users cannot access employee directory");
    }

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      role: { in: COMPANY_EMPLOYEE_ROLES }
    };
    if (query?.trim()) {
      where.OR = [
        { email: { contains: query.trim(), mode: "insensitive" } },
        { phone: { contains: query.trim(), mode: "insensitive" } }
      ];
    }
    if (role) {
      if (!COMPANY_EMPLOYEE_ROLE_SET.has(role)) {
        throw new BadRequestException("Only company employee roles are supported in Users");
      }
      where.role = role;
    }

    if (isSalesRole(actor.normalizedRole) || normalizeRole(actor.normalizedRole) === Role.PRINTING) {
      const requestedRole = role ?? Role.PRINTING;
      if (requestedRole !== Role.PRINTING) {
        throw new ForbiddenException("Sales and printing can only view PRINTING users");
      }
      where.role = Role.PRINTING;
      where.isActive = true;
    }

    return this.prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        schoolId: true,
        createdAt: true,
        school: { select: { id: true, name: true, code: true } }
      }
    });
  }

  async createUser(actor: AuthenticatedUser, dto: CreateUserDto) {
    if (dto.role === Role.PARENT) {
      throw new BadRequestException("PARENT users are created only through OTP flow");
    }
    if (dto.role === Role.SCHOOL_ADMIN || dto.role === Role.SCHOOL_STAFF) {
      throw new BadRequestException("School users are created through school onboarding only");
    }
    if (isSchoolRole(actor.normalizedRole)) {
      throw new ForbiddenException("School admin cannot create company users");
    }
    if (dto.schoolId) {
      throw new BadRequestException("schoolId is not allowed for company user creation");
    }

    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing && !existing.deletedAt) throw new ConflictException("User already exists");

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            email,
            phone: dto.phone?.trim(),
            role: dto.role,
            schoolId: null,
            passwordHash,
            isActive: true,
            deletedAt: null
          }
        })
      : await this.prisma.user.create({
          data: {
            email,
            phone: dto.phone?.trim(),
            role: dto.role,
            schoolId: null,
            passwordHash,
            isActive: true
          }
        });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "USER",
        entityId: user.id,
        action: existing ? "RESTORE_UPDATE" : "CREATE",
        newValue: { email: user.email, role: user.role, schoolId: null }
      }
    });
    if (existing && existing.role !== dto.role) {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: actor.sub,
          entityType: "USER",
          entityId: user.id,
          action: "ROLE_CHANGE",
          oldValue: { role: existing.role },
          newValue: { role: dto.role }
        }
      });
    }

    return user;
  }

  async deleteUser(actor: AuthenticatedUser, userId: string) {
    if (actor.sub === userId) throw new BadRequestException("You cannot delete your own account");
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new NotFoundException("User not found");
    if (user.role === Role.SUPER_ADMIN && !isSuperAdminRole(actor.normalizedRole)) {
      throw new ForbiddenException("Only SUPER_ADMIN can remove SUPER_ADMIN users");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false, deletedAt: new Date() }
    });
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "USER",
        entityId: userId,
        action: "SOFT_DELETE"
      }
    });
    return { message: "User removed" };
  }

  async createSchoolUser(actor: AuthenticatedUser, schoolId: string, dto: CreateSchoolUserDto) {
    if (dto.role !== Role.SCHOOL_ADMIN && dto.role !== Role.SCHOOL_STAFF) {
      throw new BadRequestException("School user role must be SCHOOL_ADMIN or SCHOOL_STAFF");
    }
    await this.assertSchoolAccess(actor, schoolId);

    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            name: dto.name?.trim(),
            email,
            phone: dto.phone?.trim(),
            passwordHash,
            role: dto.role,
            schoolId,
            isActive: true,
            deletedAt: null
          }
        })
      : await this.prisma.user.create({
          data: {
            name: dto.name?.trim(),
            email,
            phone: dto.phone?.trim(),
            passwordHash,
            role: dto.role,
            schoolId,
            isActive: true
          }
        });

    await this.prisma.userSchoolAccess.upsert({
      where: {
        userId_schoolId: {
          userId: user.id,
          schoolId
        }
      },
      create: {
        userId: user.id,
        schoolId,
        accessLevel: dto.role === Role.SCHOOL_ADMIN ? "ADMIN" : "STAFF"
      },
      update: {
        accessLevel: dto.role === Role.SCHOOL_ADMIN ? "ADMIN" : "STAFF"
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "USER",
        entityId: user.id,
        action: existing ? "RESTORE_UPDATE_SCHOOL_USER" : "CREATE_SCHOOL_USER",
        newValue: {
          email: user.email,
          role: user.role,
          schoolId
        }
      }
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId
    };
  }

  async listSalesAssignments(actor: AuthenticatedUser, schoolId?: string) {
    if (!isSuperAdminRole(actor.normalizedRole) && normalizeRole(actor.normalizedRole) !== Role.COMPANY_ADMIN) {
      throw new ForbiddenException("Not allowed");
    }
    const where: Prisma.SalesAssignmentWhereInput = {
      deletedAt: null,
      ...(schoolId ? { schoolId } : {})
    };
    return this.prisma.salesAssignment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        school: { select: { id: true, name: true, code: true } },
        salesPerson: { select: { id: true, name: true, email: true, role: true } },
        createdBy: { select: { id: true, name: true, email: true } }
      }
    });
  }

  async upsertSalesAssignment(actor: AuthenticatedUser, dto: UpsertSalesAssignmentDto) {
    if (!isSuperAdminRole(actor.normalizedRole) && normalizeRole(actor.normalizedRole) !== Role.COMPANY_ADMIN) {
      throw new ForbiddenException("Not allowed");
    }

    const [school, salesPerson] = await Promise.all([
      this.prisma.school.findUnique({ where: { id: dto.schoolId }, select: { id: true } }),
      this.prisma.user.findUnique({ where: { id: dto.salesPersonId }, select: { id: true, role: true } })
    ]);
    if (!school) throw new NotFoundException("School not found");
    if (!salesPerson || !isSalesRole(salesPerson.role)) {
      throw new BadRequestException("salesPersonId must reference a SALES_PERSON user");
    }

    const assignment = await this.prisma.salesAssignment.upsert({
      where: {
        salesPersonId_schoolId: {
          salesPersonId: dto.salesPersonId,
          schoolId: dto.schoolId
        }
      },
      create: {
        salesPersonId: dto.salesPersonId,
        schoolId: dto.schoolId,
        createdById: actor.sub
      },
      update: {
        deletedAt: null
      },
      include: {
        school: { select: { id: true, name: true, code: true } },
        salesPerson: { select: { id: true, name: true, email: true, role: true } }
      }
    });

    await this.prisma.school.update({
      where: { id: dto.schoolId },
      data: { salesOwnerId: dto.salesPersonId }
    });

    await this.prisma.userSchoolAccess.upsert({
      where: {
        userId_schoolId: {
          userId: dto.salesPersonId,
          schoolId: dto.schoolId
        }
      },
      create: {
        userId: dto.salesPersonId,
        schoolId: dto.schoolId,
        accessLevel: "SALES"
      },
      update: { accessLevel: "SALES" }
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "SALES_ASSIGNMENT",
        entityId: assignment.id,
        action: "UPSERT",
        newValue: {
          schoolId: dto.schoolId,
          salesPersonId: dto.salesPersonId
        }
      }
    });

    return assignment;
  }

  async deleteSalesAssignment(actor: AuthenticatedUser, assignmentId: string) {
    if (!isSuperAdminRole(actor.normalizedRole) && normalizeRole(actor.normalizedRole) !== Role.COMPANY_ADMIN) {
      throw new ForbiddenException("Not allowed");
    }
    const existing = await this.prisma.salesAssignment.findUnique({ where: { id: assignmentId } });
    if (!existing || existing.deletedAt) throw new NotFoundException("Assignment not found");

    await this.prisma.salesAssignment.update({
      where: { id: assignmentId },
      data: { deletedAt: new Date() }
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "SALES_ASSIGNMENT",
        entityId: assignmentId,
        action: "DELETE",
        oldValue: { salesPersonId: existing.salesPersonId, schoolId: existing.schoolId }
      }
    });

    return { message: "Assignment removed" };
  }

  async getSchoolDetail(actor: AuthenticatedUser, schoolId: string) {
    await this.assertSchoolAccess(actor, schoolId);
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        id: true,
        name: true,
        code: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        principalName: true,
        principalEmail: true,
        principalPhone: true,
        status: true,
        salesOwnerId: true,
        createdAt: true,
        managedBy: { select: { id: true, user: { select: { email: true } } } }
      }
    });
    if (!school) throw new NotFoundException("School not found");

    const [
      totalStudents,
      submitted,
      approved,
      inPrint,
      printed,
      delivered,
      rejected,
      intakeLinks,
      parents,
      invoiceAgg,
      recentStudents,
      staff
    ] = await Promise.all([
      this.prisma.student.count({ where: { schoolId, deletedAt: null } }),
      this.prisma.student.count({ where: { schoolId, status: StudentStatus.SUBMITTED, deletedAt: null } }),
      this.prisma.student.count({
        where: {
          schoolId,
          status: { in: [StudentStatus.SCHOOL_APPROVED, StudentStatus.SALES_APPROVED] },
          deletedAt: null
        }
      }),
      this.prisma.student.count({ where: { schoolId, status: StudentStatus.IN_PRINT_QUEUE, deletedAt: null } }),
      this.prisma.student.count({ where: { schoolId, status: StudentStatus.PRINTED, deletedAt: null } }),
      this.prisma.student.count({ where: { schoolId, status: StudentStatus.DELIVERED, deletedAt: null } }),
      this.prisma.student.count({ where: { schoolId, status: StudentStatus.REJECTED, deletedAt: null } }),
      this.prisma.intakeLink.count({ where: { schoolId, deletedAt: null } }),
      this.prisma.parent.count({ where: { students: { some: { schoolId } } } }),
      this.prisma.invoice.aggregate({
        where: { schoolId },
        _sum: { totalAmount: true },
        _count: { _all: true }
      }),
      this.prisma.student.findMany({
        where: { schoolId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          fullName: true,
          className: true,
          section: true,
          rollNumber: true,
          parentName: true,
          parentNameCiphertext: true,
          parentMobile: true,
          parentMobileCiphertext: true,
          status: true,
          duplicateFlag: true,
          createdAt: true
        }
      }),
      this.prisma.user.findMany({
        where: { schoolId, deletedAt: null, role: { in: [Role.SCHOOL_ADMIN, Role.SCHOOL_STAFF] } },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true
        }
      })
    ]);

    return {
      school: this.maskSchoolContacts(actor, school),
      stats: {
        totalStudents,
        submitted,
        approved,
        inPrint,
        printed,
        delivered,
        rejected,
        intakeLinks,
        parents,
        invoices: invoiceAgg._count._all,
        invoiceTotal: Number(invoiceAgg._sum.totalAmount ?? 0)
      },
      recentStudents: recentStudents.map((row) => this.maskStudentSummary(actor, row)),
      staff
    };
  }

  async listSchoolStudents(actor: AuthenticatedUser, schoolId: string, query: StudentQuery) {
    await this.assertSchoolAccess(actor, schoolId);
    const page = Math.max(Number(query.page || 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 200);
    const where: Prisma.StudentWhereInput = { schoolId, deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.className?.trim()) where.className = query.className.trim().toUpperCase();
    if (query.q?.trim()) {
      const text = query.q.trim();
      where.OR = [
        { fullName: { contains: text, mode: "insensitive" } },
        { rollNumber: { contains: text, mode: "insensitive" } }
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          fullName: true,
          className: true,
          section: true,
          rollNumber: true,
          parentName: true,
          parentNameCiphertext: true,
          parentMobile: true,
          parentMobileCiphertext: true,
          status: true,
          duplicateFlag: true,
          rejectionNote: true,
          createdAt: true
        }
      })
    ]);
    return { page, pageSize, total, rows: rows.map((row) => this.maskStudentSummary(actor, row)) };
  }

  async listSchoolClassSummary(actor: AuthenticatedUser, schoolId: string) {
    await this.assertSchoolAccess(actor, schoolId);
    const grouped = await this.prisma.student.groupBy({
      by: ["className", "section", "status"],
      where: { schoolId, deletedAt: null },
      _count: { _all: true }
    });

    const map = new Map<
      string,
      {
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
      }
    >();

    grouped.forEach((row) => {
      const key = `${row.className}__${row.section}`;
      if (!map.has(key)) {
        map.set(key, {
          className: row.className,
          section: row.section,
          total: 0,
          submitted: 0,
          schoolApproved: 0,
          salesApproved: 0,
          inPrintQueue: 0,
          printed: 0,
          delivered: 0,
          rejected: 0
        });
      }
      const bucket = map.get(key)!;
      const count = row._count._all;
      bucket.total += count;
      if (row.status === StudentStatus.SUBMITTED) bucket.submitted += count;
      if (row.status === StudentStatus.SCHOOL_APPROVED) bucket.schoolApproved += count;
      if (row.status === StudentStatus.SALES_APPROVED) bucket.salesApproved += count;
      if (row.status === StudentStatus.IN_PRINT_QUEUE) bucket.inPrintQueue += count;
      if (row.status === StudentStatus.PRINTED) bucket.printed += count;
      if (row.status === StudentStatus.DELIVERED) bucket.delivered += count;
      if (row.status === StudentStatus.REJECTED) bucket.rejected += count;
    });

    return {
      schoolId,
      rows: Array.from(map.values()).sort((a, b) => {
        if (a.className === b.className) return a.section.localeCompare(b.section);
        return a.className.localeCompare(b.className, undefined, { numeric: true, sensitivity: "base" });
      })
    };
  }

  async buildSchoolReport(actor: AuthenticatedUser, query: ReportQuery) {
    let allowedSchoolIds: string[] | null = null;
    if (isSchoolRole(actor.normalizedRole) && actor.schoolId) query.schoolId = actor.schoolId;
    if (isSalesRole(actor.normalizedRole)) {
      allowedSchoolIds = actor.assignedSchoolIds;
      if (query.schoolId && !allowedSchoolIds.includes(query.schoolId)) {
        throw new ForbiddenException("Sales can only view assigned schools");
      }
    }
    const createdAtFilter = this.parseDateRange(query.dateFrom, query.dateTo);

    const schools = await this.prisma.school.findMany({
      where: {
        deletedAt: null,
        ...(query.schoolId ? { id: query.schoolId } : {}),
        ...(allowedSchoolIds ? { id: { in: allowedSchoolIds } } : {})
      },
      select: { id: true, name: true, code: true, email: true, createdAt: true },
      orderBy: { name: "asc" }
    });
    const schoolIds = schools.map((s) => s.id);

    const studentWhere: Prisma.StudentWhereInput = {
      deletedAt: null,
      schoolId: schoolIds.length ? { in: schoolIds } : undefined,
      ...(query.status ? { status: query.status } : {}),
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {})
    };
    const groupedStudents = schoolIds.length
      ? await this.prisma.student.groupBy({
          by: ["schoolId", "status"],
          where: studentWhere,
          _count: { _all: true }
        })
      : [];

    const invoiceRows = schoolIds.length
      ? await this.prisma.invoice.groupBy({
          by: ["schoolId"],
          where: {
            schoolId: { in: schoolIds },
            ...(createdAtFilter ? { issuedAt: createdAtFilter } : {})
          },
          _sum: { totalAmount: true }
        })
      : [];

    const studentMap = new Map<string, Partial<Record<StudentStatus, number>>>();
    groupedStudents.forEach((row) => {
      const current = studentMap.get(row.schoolId) ?? {};
      current[row.status as StudentStatus] = row._count._all;
      studentMap.set(row.schoolId, current);
    });
    const invoiceMap = new Map<string, number>();
    invoiceRows.forEach((row) => invoiceMap.set(row.schoolId, Number(row._sum.totalAmount ?? 0)));

    const rows = schools.map((school) => {
      const byStatus = studentMap.get(school.id) ?? {};
      const total = Object.values(byStatus).reduce((acc, n) => acc + (n ?? 0), 0);
      const delivered = byStatus[StudentStatus.DELIVERED] ?? 0;
      const submitted =
        (byStatus[StudentStatus.SUBMITTED] ?? 0) +
        (byStatus[StudentStatus.SCHOOL_APPROVED] ?? 0) +
        (byStatus[StudentStatus.SALES_APPROVED] ?? 0) +
        (byStatus[StudentStatus.IN_PRINT_QUEUE] ?? 0) +
        (byStatus[StudentStatus.PRINTED] ?? 0) +
        delivered;

      return {
        schoolId: school.id,
        schoolName: school.name,
        schoolCode: school.code,
        schoolEmail: school.email,
        submitted,
        approved: (byStatus[StudentStatus.SCHOOL_APPROVED] ?? 0) + (byStatus[StudentStatus.SALES_APPROVED] ?? 0),
        inPrint: byStatus[StudentStatus.IN_PRINT_QUEUE] ?? 0,
        printed: byStatus[StudentStatus.PRINTED] ?? 0,
        delivered,
        rejected: byStatus[StudentStatus.REJECTED] ?? 0,
        totalStudents: total,
        completionPercent: total > 0 ? Number(((delivered / total) * 100).toFixed(1)) : 0,
        revenueInr: Number(invoiceMap.get(school.id) ?? 0)
      };
    });

    const totals = rows.reduce(
      (acc, row) => {
        acc.schools += 1;
        acc.totalStudents += row.totalStudents;
        acc.submitted += row.submitted;
        acc.approved += row.approved;
        acc.inPrint += row.inPrint;
        acc.printed += row.printed;
        acc.delivered += row.delivered;
        acc.rejected += row.rejected;
        acc.revenueInr += row.revenueInr;
        return acc;
      },
      {
        schools: 0,
        totalStudents: 0,
        submitted: 0,
        approved: 0,
        inPrint: 0,
        printed: 0,
        delivered: 0,
        rejected: 0,
        revenueInr: 0
      }
    );
    return { rows, totals };
  }

  async exportSchoolReportCsv(actor: AuthenticatedUser, query: ReportQuery) {
    this.assertCanExportSchoolReport(actor);
    const report = await this.buildSchoolReport(actor, query);
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "REPORT",
        entityId: query.schoolId || "SCHOOLS",
        action: "EXPORT_SCHOOL_REPORT_CSV",
        newValue: {
          schoolId: query.schoolId || null,
          dateFrom: query.dateFrom || null,
          dateTo: query.dateTo || null,
          status: query.status || null,
          rowCount: report.rows.length
        } as Prisma.InputJsonValue
      }
    });
    const header = [
      "School Code",
      "School Name",
      "Email",
      "Submitted",
      "Approved",
      "In Print Queue",
      "Printed",
      "Delivered",
      "Rejected",
      "Total Students",
      "Completion Percent",
      "Revenue INR"
    ];
    const lines = [header.join(",")];
    report.rows.forEach((row) => {
      lines.push(
        [
          this.csvCell(row.schoolCode),
          this.csvCell(row.schoolName),
          this.csvCell(row.schoolEmail),
          row.submitted,
          row.approved,
          row.inPrint,
          row.printed,
          row.delivered,
          row.rejected,
          row.totalStudents,
          row.completionPercent,
          row.revenueInr.toFixed(2)
        ].join(",")
      );
    });
    return lines.join("\n");
  }

  async dispatchToPrint(actor: AuthenticatedUser, dto: DispatchPrintDto) {
    if (!dto.studentIds.length) throw new BadRequestException("studentIds required");
    const studentIds = [...new Set(dto.studentIds.map((id) => id.trim()).filter(Boolean))];
    if (!studentIds.length) throw new BadRequestException("studentIds required");

    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds }, deletedAt: null },
      select: { id: true, schoolId: true, status: true, intakeStage: true }
    });
    if (students.length !== studentIds.length) throw new NotFoundException("Some students not found");

    const schoolIds = Array.from(new Set(students.map((s) => s.schoolId)));
    if (schoolIds.length !== 1) throw new BadRequestException("All students must belong to same school");
    const schoolId = schoolIds[0];
    this.resolveScopedSchoolIds(actor, schoolId);

    const notReady = students.filter(
      (student) => student.intakeStage !== IntakeSubmissionStage.APPROVED_FOR_PRINT && !dto.forceRequeue
    );
    if (notReady.length > 0) {
      throw new BadRequestException(
        `Only production-ready students can be dispatched. Not ready: ${notReady.map((s) => s.id).join(", ")}`
      );
    }

    if (dto.assignedToId) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: dto.assignedToId },
        select: { id: true, role: true, deletedAt: true }
      });
      if (!assignee || assignee.deletedAt) throw new NotFoundException("Assigned print user not found");
      const normalizedAssigneeRole = normalizeRole(assignee.role);
      if (normalizedAssigneeRole !== Role.PRINTING && normalizedAssigneeRole !== Role.PRINT_OPS) {
        throw new BadRequestException("assignedToId must be a PRINTING or PRINT_OPS user");
      }
    }

    const batchCode = dto.batchCode?.trim() || this.generateBatchCode("PB");
    const order = await this.prisma.order.create({
      data: { schoolId, status: OrderStatus.READY_FOR_PRINT }
    });
    await this.prisma.orderStudent.createMany({
      data: students.map((s) => ({ orderId: order.id, studentId: s.id }))
    });

    const printJob = await this.prisma.printJob.create({
      data: {
        schoolId,
        orderId: order.id,
        assignedToId: dto.assignedToId,
        batchCode,
        isReprint: false,
        status: OrderStatus.READY_FOR_PRINT,
        notes: dto.notes?.trim(),
        artifactMetaJson: {
          sheetType: dto.sheetType || "CARD_54x86",
          layoutMode: dto.layoutMode || "GRID"
        } as Prisma.InputJsonValue
      }
    });
    await this.prisma.printJobStudent.createMany({
      data: students.map((s, index) => ({ printJobId: printJob.id, studentId: s.id, position: index + 1 }))
    });
    await this.prisma.student.updateMany({
      where: { id: { in: students.map((s) => s.id) } },
      data: {
        status: StudentStatus.IN_PRINT_QUEUE,
        intakeStage: IntakeSubmissionStage.IN_PRINT_QUEUE
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "PRINT_JOB",
        entityId: printJob.id,
        action: "DISPATCH_TO_PRINT",
        newValue: {
          studentCount: students.length,
          schoolId,
          assignedToId: dto.assignedToId ?? null,
          batchCode,
          sheetType: dto.sheetType || "CARD_54x86",
          layoutMode: dto.layoutMode || "GRID"
        } as Prisma.InputJsonValue
      }
    });

    return this.getPrintJob(actor, printJob.id);
  }

  async listPrintJobs(actor: AuthenticatedUser) {
    const scopedSchoolIds = this.resolveScopedSchoolIds(actor);
    const where: Prisma.PrintJobWhereInput = scopedSchoolIds ? { schoolId: { in: scopedSchoolIds } } : {};

    return this.prisma.printJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        school: { select: { id: true, name: true, code: true } },
        assignedTo: { select: { id: true, email: true, role: true } },
        _count: { select: { items: true } },
        order: { select: { id: true, status: true } }
      }
    });
  }

  async getPrintJob(actor: AuthenticatedUser, printJobId: string) {
    const printJob = await this.prisma.printJob.findUnique({
      where: { id: printJobId },
      include: {
        school: { select: { id: true, name: true, code: true } },
        assignedTo: { select: { id: true, email: true, role: true } },
        sourcePrintJob: { select: { id: true, batchCode: true, status: true } },
        order: { select: { id: true, status: true, createdAt: true } },
        items: {
          orderBy: { position: "asc" },
          include: {
            student: {
              select: {
                id: true,
                fullName: true,
                className: true,
                section: true,
                rollNumber: true,
                photoKey: true,
                status: true,
                intakeStage: true
              }
            }
          }
        }
      }
    });
    if (!printJob) throw new NotFoundException("Print job not found");
    this.resolveScopedSchoolIds(actor, printJob.schoolId);
    return printJob;
  }

  async updatePrintJobStatus(actor: AuthenticatedUser, printJobId: string, dto: UpdatePrintJobStatusDto) {
    const printJob = await this.prisma.printJob.findUnique({
      where: { id: printJobId },
      include: {
        items: { select: { studentId: true } }
      }
    });
    if (!printJob) throw new NotFoundException("Print job not found");
    this.resolveScopedSchoolIds(actor, printJob.schoolId);

    const transitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.CREATED]: [OrderStatus.READY_FOR_PRINT, OrderStatus.PRINTING],
      [OrderStatus.READY_FOR_PRINT]: [OrderStatus.PRINTING],
      [OrderStatus.PRINTING]: [OrderStatus.PRINTED],
      [OrderStatus.PRINTED]: [OrderStatus.DISPATCHED],
      [OrderStatus.DISPATCHED]: []
    };
    if (!transitions[printJob.status].includes(dto.status)) {
      throw new BadRequestException(`Invalid print job transition ${printJob.status} -> ${dto.status}`);
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.printJob.update({
        where: { id: printJob.id },
        data: {
          status: dto.status,
          notes: dto.notes?.trim() || printJob.notes,
          startedAt: dto.status === OrderStatus.PRINTING ? printJob.startedAt || now : printJob.startedAt,
          completedAt: dto.status === OrderStatus.PRINTED ? now : printJob.completedAt,
          dispatchedAt: dto.status === OrderStatus.DISPATCHED ? now : printJob.dispatchedAt
        }
      });

      if (printJob.orderId) {
        await tx.order.update({
          where: { id: printJob.orderId },
          data: { status: dto.status }
        });
      }

      if (dto.status === OrderStatus.PRINTED) {
        await tx.student.updateMany({
          where: { id: { in: printJob.items.map((item) => item.studentId) } },
          data: {
            status: StudentStatus.PRINTED,
            intakeStage: IntakeSubmissionStage.PRINTED
          }
        });
      }

      if (dto.status === OrderStatus.DISPATCHED) {
        await tx.student.updateMany({
          where: { id: { in: printJob.items.map((item) => item.studentId) } },
          data: {
            status: StudentStatus.DELIVERED,
            intakeStage: IntakeSubmissionStage.DISPATCHED
          }
        });
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "PRINT_JOB",
        entityId: printJob.id,
        action: "STATUS_UPDATE",
        oldValue: { status: printJob.status } as Prisma.InputJsonValue,
        newValue: {
          status: dto.status,
          notes: dto.notes?.trim() || null
        } as Prisma.InputJsonValue
      }
    });

    return this.getPrintJob(actor, printJob.id);
  }

  async generatePrintArtifact(actor: AuthenticatedUser, printJobId: string, dto: GeneratePrintArtifactDto) {
    this.assertCanGeneratePrintArtifact(actor);
    const printJob = await this.getPrintJob(actor, printJobId);
    const rows = printJob.items.map((item, index) => ({
      position: index + 1,
      studentId: item.student.id,
      fullName: item.student.fullName,
      className: item.student.className,
      section: item.student.section,
      rollNumber: item.student.rollNumber,
      photoKey: item.student.photoKey
    }));

    const format = dto.format || "CSV";
    let artifactBuffer: Buffer;
    if (format === "PDF") {
      artifactBuffer = await this.buildRenderBatchPdf({
        batchId: printJob.id,
        schoolName: printJob.school.name,
        templateName: "Print Job Export",
        templateCode: printJob.batchCode || printJob.id,
        sideMode: dto.sideMode || "FRONT_BACK",
        pageSize: dto.pageSize || "A4",
        customPageMm: dto.customPageMm,
        grid: dto.grid || "3x8",
        items: printJob.items.map((item) => ({
          id: item.id,
          student: item.student,
          status: RenderBatchItemStatus.SUCCESS,
          previewJson: {
            tokenMap: {
              student_name: item.student.fullName,
              class: item.student.className,
              section: item.student.section,
              roll_number: item.student.rollNumber,
              student_id: item.student.id,
              school_name: printJob.school.name,
              school_code: printJob.school.code
            }
          }
        }))
      });
    } else if (format === "JSON") {
      artifactBuffer = Buffer.from(
        JSON.stringify(
          {
            printJobId: printJob.id,
            generatedAt: new Date().toISOString(),
            rows
          },
          null,
          2
        ),
        "utf8"
      );
    } else {
      const header = ["position", "studentId", "fullName", "className", "section", "rollNumber", "photoKey"];
      const csv = [header.join(",")]
        .concat(
          rows.map((row) =>
            [
              row.position,
              this.csvCell(row.studentId),
              this.csvCell(row.fullName),
              this.csvCell(row.className || ""),
              this.csvCell(row.section || ""),
              this.csvCell(row.rollNumber || ""),
              this.csvCell(row.photoKey || "")
            ].join(",")
          )
        )
        .join("\n");
      artifactBuffer = Buffer.from(csv, "utf8");
    }

    const persisted = await this.persistGeneratedArtifact("print-jobs", printJob.id, format.toLowerCase(), artifactBuffer);
    const printFileUrl = `generated://print-jobs/${persisted.fileName}`;
    await this.prisma.printJob.update({
      where: { id: printJob.id },
      data: {
        printFileUrl,
        artifactMetaJson: {
          format,
          generatedAt: new Date().toISOString(),
          timezone: dto.timezone || "Asia/Kolkata",
          rowCount: rows.length,
          byteSize: artifactBuffer.byteLength,
          localPath: persisted.localPath
        } as Prisma.InputJsonValue
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "PRINT_JOB",
        entityId: printJob.id,
        action: "ARTIFACT_GENERATED",
        newValue: { format, printFileUrl, rowCount: rows.length } as Prisma.InputJsonValue
      }
    });

    return {
      printJobId: printJob.id,
      format,
      rowCount: rows.length,
      printFileUrl,
      fileName: persisted.fileName,
      byteSize: artifactBuffer.byteLength,
      previewRows: rows.slice(0, 5)
    };
  }

  async exportPrintJobCsv(actor: AuthenticatedUser, printJobId: string) {
    this.assertCanExportPrintJob(actor);
    const printJob = await this.getPrintJob(actor, printJobId);
    const header = [
      "Position",
      "Student ID",
      "Student Name",
      "Class",
      "Section",
      "Roll Number",
      "Photo Key",
      "School Code",
      "School Name",
      "Batch Code"
    ];
    const lines = [header.join(",")];
    printJob.items.forEach((item, index) => {
      lines.push(
        [
          index + 1,
          this.csvCell(item.student.id),
          this.csvCell(item.student.fullName),
          this.csvCell(item.student.className),
          this.csvCell(item.student.section),
          this.csvCell(item.student.rollNumber),
          this.csvCell(item.student.photoKey),
          this.csvCell(printJob.school.code),
          this.csvCell(printJob.school.name),
          this.csvCell(printJob.batchCode || "")
        ].join(",")
      );
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "PRINT_JOB",
        entityId: printJob.id,
        action: "EXPORT_CSV",
        newValue: {
          schoolId: printJob.schoolId,
          rowCount: printJob.items.length
        } as Prisma.InputJsonValue
      }
    });
    return lines.join("\n");
  }

  async requestStudentReissue(actor: AuthenticatedUser, studentId: string, dto: RequestReissueDto) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student || student.deletedAt) throw new NotFoundException("Student not found");
    this.resolveScopedSchoolIds(actor, student.schoolId);

    const updated = await this.prisma.student.update({
      where: { id: studentId },
      data: {
        intakeStage: IntakeSubmissionStage.REISSUE_REQUESTED,
        status: StudentStatus.SUBMITTED,
        rejectionNote: dto.reason.trim()
      }
    });

    await this.prisma.correctionLog.create({
      data: {
        schoolId: student.schoolId,
        studentId: student.id,
        actorUserId: actor.sub,
        reason: `Reissue requested: ${dto.reason.trim()}`,
        beforeJson: this.sanitizeAuditPayload(JSON.parse(JSON.stringify(student))),
        afterJson: this.sanitizeAuditPayload(JSON.parse(JSON.stringify(updated)))
      }
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "STUDENT",
        entityId: student.id,
        action: "REISSUE_REQUESTED",
        newValue: { reason: dto.reason.trim() } as Prisma.InputJsonValue
      }
    });

    return {
      studentId: student.id,
      intakeStage: updated.intakeStage,
      status: updated.status,
      message: "Reissue request created"
    };
  }

  async createReprintBatch(actor: AuthenticatedUser, dto: CreateReprintBatchDto) {
    const studentIds = [...new Set(dto.studentIds.map((id) => id.trim()).filter(Boolean))];
    if (!studentIds.length) throw new BadRequestException("studentIds required");

    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds }, deletedAt: null },
      select: { id: true, schoolId: true, status: true, intakeStage: true }
    });
    if (students.length !== studentIds.length) throw new NotFoundException("Some students not found");

    const schoolIds = [...new Set(students.map((student) => student.schoolId))];
    if (schoolIds.length !== 1) throw new BadRequestException("All students must belong to same school");
    const schoolId = schoolIds[0];
    this.resolveScopedSchoolIds(actor, schoolId);

    const reprintEligibleStages = new Set<IntakeSubmissionStage>([
      IntakeSubmissionStage.PRINTED,
      IntakeSubmissionStage.DISPATCHED,
      IntakeSubmissionStage.ISSUED,
      IntakeSubmissionStage.REISSUE_REQUESTED,
      IntakeSubmissionStage.REISSUED
    ]);
    const invalidStudents = students.filter(
      (student) =>
        !reprintEligibleStages.has(student.intakeStage) &&
        student.status !== StudentStatus.PRINTED &&
        student.status !== StudentStatus.DELIVERED
    );
    if (invalidStudents.length > 0) {
      throw new BadRequestException(
        `Students not eligible for reprint: ${invalidStudents.map((student) => student.id).join(", ")}`
      );
    }

    let sourcePrintJobId: string | null = null;
    if (dto.sourcePrintJobId?.trim()) {
      const source = await this.prisma.printJob.findUnique({
        where: { id: dto.sourcePrintJobId.trim() },
        select: { id: true, schoolId: true }
      });
      if (!source) throw new NotFoundException("sourcePrintJobId not found");
      if (source.schoolId !== schoolId) {
        throw new BadRequestException("sourcePrintJobId school mismatch");
      }
      sourcePrintJobId = source.id;
    }

    if (dto.assignedToId) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: dto.assignedToId },
        select: { id: true, role: true, deletedAt: true }
      });
      if (!assignee || assignee.deletedAt) throw new NotFoundException("Assigned print user not found");
      const normalizedAssigneeRole = normalizeRole(assignee.role);
      if (normalizedAssigneeRole !== Role.PRINTING && normalizedAssigneeRole !== Role.PRINT_OPS) {
        throw new BadRequestException("assignedToId must be a PRINTING or PRINT_OPS user");
      }
    }

    const batchCode = dto.batchCode?.trim() || this.generateBatchCode("RPB");
    const order = await this.prisma.order.create({
      data: { schoolId, status: OrderStatus.READY_FOR_PRINT }
    });
    await this.prisma.orderStudent.createMany({
      data: students.map((student) => ({ orderId: order.id, studentId: student.id }))
    });

    const printJob = await this.prisma.printJob.create({
      data: {
        schoolId,
        orderId: order.id,
        sourcePrintJobId,
        assignedToId: dto.assignedToId,
        batchCode,
        isReprint: true,
        status: OrderStatus.READY_FOR_PRINT,
        notes: `REPRINT: ${dto.reason.trim()}`,
        artifactMetaJson: {
          reason: dto.reason.trim(),
          sourcePrintJobId
        } as Prisma.InputJsonValue
      }
    });
    await this.prisma.printJobStudent.createMany({
      data: students.map((student, index) => ({
        printJobId: printJob.id,
        studentId: student.id,
        position: index + 1
      }))
    });
    await this.prisma.student.updateMany({
      where: { id: { in: students.map((student) => student.id) } },
      data: {
        status: StudentStatus.IN_PRINT_QUEUE,
        intakeStage: IntakeSubmissionStage.IN_PRINT_QUEUE
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "PRINT_JOB",
        entityId: printJob.id,
        action: "REPRINT_BATCH_CREATE",
        newValue: {
          batchCode,
          reason: dto.reason.trim(),
          studentCount: students.length,
          sourcePrintJobId
        } as Prisma.InputJsonValue
      }
    });

    return this.getPrintJob(actor, printJob.id);
  }

  async markPrintJobIssued(actor: AuthenticatedUser, printJobId: string, dto: MarkPrintJobIssuedDto) {
    const printJob = await this.prisma.printJob.findUnique({
      where: { id: printJobId },
      include: { items: { select: { studentId: true } } }
    });
    if (!printJob) throw new NotFoundException("Print job not found");
    this.resolveScopedSchoolIds(actor, printJob.schoolId);

    const nextStage = dto.reissued ? IntakeSubmissionStage.REISSUED : IntakeSubmissionStage.ISSUED;
    await this.prisma.student.updateMany({
      where: { id: { in: printJob.items.map((item) => item.studentId) } },
      data: {
        status: StudentStatus.DELIVERED,
        intakeStage: nextStage
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "PRINT_JOB",
        entityId: printJob.id,
        action: dto.reissued ? "MARK_REISSUED" : "MARK_ISSUED",
        newValue: {
          studentCount: printJob.items.length,
          intakeStage: nextStage
        } as Prisma.InputJsonValue
      }
    });

    return {
      printJobId: printJob.id,
      updatedStudents: printJob.items.length,
      intakeStage: nextStage
    };
  }

  async listAuditLogs(actor: AuthenticatedUser, query: AuditLogQuery) {
    const role = normalizeRole(actor.normalizedRole);
    if (role !== Role.SUPER_ADMIN && role !== Role.COMPANY_ADMIN && role !== Role.HR && role !== Role.HR_ADMIN) {
      throw new ForbiddenException("Not allowed to access audit logs");
    }

    const page = Math.max(Number(query.page || 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
    const where: Prisma.AuditLogWhereInput = {};
    if (query.entityType?.trim()) where.entityType = query.entityType.trim().toUpperCase();
    if (query.actorUserId?.trim()) where.actorUserId = query.actorUserId.trim();

    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          actorUser: { select: { id: true, email: true, role: true } }
        }
      })
    ]);
    return {
      page,
      pageSize,
      total,
      rows: rows.map((row) => this.sanitizeAuditLogRow(row))
    };
  }

  async listSchoolAuditLogs(actor: AuthenticatedUser, schoolId: string, query: SchoolAuditLogQuery) {
    await this.assertSchoolAccess(actor, schoolId);
    const page = Math.max(Number(query.page || 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);

    const [studentRows, invoiceRows, printRows, linkRows] = await Promise.all([
      this.prisma.student.findMany({ where: { schoolId }, select: { id: true } }),
      this.prisma.invoice.findMany({ where: { schoolId }, select: { id: true } }),
      this.prisma.printJob.findMany({ where: { schoolId }, select: { id: true } }),
      this.prisma.intakeLink.findMany({ where: { schoolId }, select: { id: true } })
    ]);
    const studentIds = studentRows.map((r) => r.id);
    const invoiceIds = invoiceRows.map((r) => r.id);
    const printJobIds = printRows.map((r) => r.id);
    const intakeLinkIds = linkRows.map((r) => r.id);

    const orConditions: Prisma.AuditLogWhereInput[] = [{ entityType: "SCHOOL", entityId: schoolId }];
    if (studentIds.length) orConditions.push({ entityType: "STUDENT", entityId: { in: studentIds } });
    if (invoiceIds.length) orConditions.push({ entityType: "INVOICE", entityId: { in: invoiceIds } });
    if (printJobIds.length) orConditions.push({ entityType: "PRINT_JOB", entityId: { in: printJobIds } });
    if (intakeLinkIds.length) orConditions.push({ entityType: "INTAKE_LINK", entityId: { in: intakeLinkIds } });

    const where: Prisma.AuditLogWhereInput = { OR: orConditions };
    if (query.entityType?.trim()) where.entityType = query.entityType.trim().toUpperCase();

    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          actorUser: { select: { id: true, email: true, role: true } }
        }
      })
    ]);
    return {
      page,
      pageSize,
      total,
      rows: rows.map((row) => this.sanitizeAuditLogRow(row))
    };
  }

  async updateSchool(actor: AuthenticatedUser, schoolId: string, dto: UpdateSchoolDto) {
    await this.assertSchoolAccess(actor, schoolId);
    const current = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!current || current.deletedAt) throw new NotFoundException("School not found");

    if (isSalesRole(actor.normalizedRole) && dto.salesOwnerId && dto.salesOwnerId !== actor.sub) {
      throw new ForbiddenException("Sales cannot reassign school ownership");
    }

    const updated = await this.prisma.school.update({
      where: { id: schoolId },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.email ? { email: dto.email.trim().toLowerCase() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
        ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
        ...(dto.city !== undefined ? { city: dto.city?.trim() || null } : {}),
        ...(dto.state !== undefined ? { state: dto.state?.trim() || null } : {}),
        ...(dto.principalName !== undefined ? { principalName: dto.principalName?.trim() || null } : {}),
        ...(dto.principalEmail !== undefined ? { principalEmail: dto.principalEmail?.trim().toLowerCase() || null } : {}),
        ...(dto.principalPhone !== undefined ? { principalPhone: dto.principalPhone?.trim() || null } : {}),
        ...(dto.salesOwnerId !== undefined ? { salesOwnerId: dto.salesOwnerId || null } : {}),
        ...(dto.status ? { status: dto.status as SchoolStatus } : {})
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "SCHOOL",
        entityId: schoolId,
        action: "UPDATE",
        oldValue: this.sanitizeAuditPayload(JSON.parse(JSON.stringify(current))),
        newValue: this.sanitizeAuditPayload(JSON.parse(JSON.stringify(updated)))
      }
    });
    return updated;
  }

  async updateStudent(actor: AuthenticatedUser, studentId: string, dto: UpdateStudentDto) {
    const current = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!current || current.deletedAt) throw new NotFoundException("Student not found");
    await this.assertSchoolAccess(actor, current.schoolId);

    const data: Prisma.StudentUpdateInput = {
      ...(dto.fullName ? { fullName: dto.fullName.trim() } : {}),
      ...(dto.className ? { className: dto.className.trim().toUpperCase() } : {}),
      ...(dto.section ? { section: dto.section.trim().toUpperCase() } : {}),
      ...(dto.rollNumber ? { rollNumber: dto.rollNumber.trim() } : {}),
      ...(dto.status ? { status: dto.status as StudentStatus } : {})
    };
    this.applyStudentSensitiveProtection(data, {
      ...(dto.parentName !== undefined ? { parentName: dto.parentName } : {}),
      ...(dto.address !== undefined ? { address: dto.address } : {})
    });

    const updated = await this.prisma.student.update({
      where: { id: studentId },
      data
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "STUDENT",
        entityId: studentId,
        action: "UPDATE",
        oldValue: this.sanitizeAuditPayload(JSON.parse(JSON.stringify(current))),
        newValue: this.sanitizeAuditPayload(JSON.parse(JSON.stringify(updated)))
      }
    });
    return updated;
  }

  async listReviewQueue(actor: AuthenticatedUser, query: ReviewQueueQuery) {
    let schoolIds: string[] | undefined;
    if (query.schoolId) {
      await this.assertSchoolAccess(actor, query.schoolId);
      schoolIds = [query.schoolId];
    } else if (isSchoolRole(actor.normalizedRole)) {
      if (!actor.schoolId) throw new ForbiddenException("School context missing");
      schoolIds = [actor.schoolId];
    } else if (isSalesRole(actor.normalizedRole)) {
      schoolIds = actor.assignedSchoolIds.length ? actor.assignedSchoolIds : ["__none__"];
    }

    const page = Math.max(Number(query.page || 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
    const where: Prisma.StudentWhereInput = {
      deletedAt: null,
      ...(schoolIds ? { schoolId: { in: schoolIds } } : {}),
      ...(query.intakeStage ? { intakeStage: query.intakeStage } : {})
    };

    if ((query.duplicateOnly || "").toLowerCase() === "true") {
      where.duplicateFlag = true;
    }
    if (query.q?.trim()) {
      const text = query.q.trim();
      where.OR = [
        { fullName: { contains: text, mode: "insensitive" } },
        { rollNumber: { contains: text, mode: "insensitive" } }
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        orderBy: [{ duplicateFlag: "desc" }, { updatedAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          fullName: true,
          className: true,
          section: true,
          rollNumber: true,
          parentName: true,
          parentNameCiphertext: true,
          parentMobile: true,
          parentMobileCiphertext: true,
          address: true,
          addressCiphertext: true,
          status: true,
          intakeStage: true,
          duplicateFlag: true,
          photoQualityStatus: true,
          photoKey: true,
          rejectionNote: true,
          updatedAt: true,
          createdAt: true,
          school: { select: { id: true, name: true, code: true } },
          parent: { select: { id: true, mobile: true, mobileCiphertext: true } }
        }
      })
    ]);

    return {
      page,
      pageSize,
      total,
      rows: rows.map((row) => this.maskReviewQueueRow(actor, row))
    };
  }

  async applyCorrection(actor: AuthenticatedUser, studentId: string, dto: ApplyCorrectionDto) {
    const current = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!current || current.deletedAt) throw new NotFoundException("Student not found");
    await this.assertSchoolAccess(actor, current.schoolId);

    const data: Prisma.StudentUpdateInput = {
      ...(dto.fullName ? { fullName: dto.fullName.trim() } : {}),
      ...(dto.className ? { className: dto.className.trim().toUpperCase() } : {}),
      ...(dto.section ? { section: dto.section.trim().toUpperCase() } : {}),
      ...(dto.rollNumber ? { rollNumber: dto.rollNumber.trim() } : {}),
      ...(dto.photoKey ? { photoKey: dto.photoKey.trim() } : {}),
      ...(dto.status ? { status: dto.status } : {}),
      intakeStage: dto.intakeStage || IntakeSubmissionStage.SALES_CORRECTED,
      correctedAt: new Date()
    };
    this.applyStudentSensitiveProtection(data, {
      ...(dto.parentName !== undefined ? { parentName: dto.parentName } : {}),
      ...(dto.address !== undefined ? { address: dto.address } : {})
    });

    const updated = await this.prisma.student.update({
      where: { id: studentId },
      data
    });

    const correctionLog = await this.prisma.correctionLog.create({
      data: {
        schoolId: current.schoolId,
        studentId,
        actorUserId: actor.sub,
        reason: dto.reason.trim(),
        beforeJson: this.sanitizeAuditPayload(JSON.parse(JSON.stringify(current))),
        afterJson: this.sanitizeAuditPayload(JSON.parse(JSON.stringify(updated)))
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "STUDENT",
        entityId: studentId,
        action: "CORRECTION_APPLIED",
        oldValue: this.sanitizeAuditPayload(JSON.parse(JSON.stringify(current))),
        newValue: this.sanitizeAuditPayload(JSON.parse(JSON.stringify(updated)))
      }
    });

    return { updated, correctionLogId: correctionLog.id };
  }

  async listStudentCorrections(actor: AuthenticatedUser, studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, schoolId: true }
    });
    if (!student) throw new NotFoundException("Student not found");
    await this.assertSchoolAccess(actor, student.schoolId);

    const rows = await this.prisma.correctionLog.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      include: {
        actorUser: { select: { id: true, email: true, role: true } }
      }
    });
    return rows.map((row) => this.sanitizeCorrectionLogRow(row));
  }

  async validateStudent(actor: AuthenticatedUser, studentId: string, dto: ValidateStudentDto) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student || student.deletedAt) throw new NotFoundException("Student not found");
    await this.assertSchoolAccess(actor, student.schoolId);

    const issues: string[] = [];
    if (!student.fullName?.trim()) issues.push("Missing student name");
    if (!student.parentName?.trim()) issues.push("Missing parent name");
    if (!student.className?.trim()) issues.push("Missing class");
    if (!student.section?.trim()) issues.push("Missing section");
    if (!student.rollNumber?.trim()) issues.push("Missing roll number");
    if (!student.address?.trim()) issues.push("Missing address");
    if (!student.photoKey?.trim()) issues.push("Missing photo");
    if (student.duplicateFlag) issues.push("Duplicate record flagged");
    if (student.photoQualityStatus === "FAILED") issues.push("Photo quality failed");

    const nextStage =
      issues.length > 0 ? IntakeSubmissionStage.VALIDATION_FAILED : IntakeSubmissionStage.UNDER_REVIEW;

    const updated = await this.prisma.student.update({
      where: { id: studentId },
      data: {
        intakeStage: nextStage,
        correctedAt: issues.length ? new Date() : student.correctedAt
      }
    });

    await this.prisma.correctionLog.create({
      data: {
        schoolId: student.schoolId,
        studentId,
        actorUserId: actor.sub,
        reason: issues.length
          ? `Validation failed: ${issues.join("; ")}`
          : `Validation passed${dto.note ? ` (${dto.note})` : ""}`,
        beforeJson: this.sanitizeAuditPayload(JSON.parse(JSON.stringify(student))),
        afterJson: this.sanitizeAuditPayload(JSON.parse(JSON.stringify(updated)))
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "STUDENT",
        entityId: studentId,
        action: "VALIDATION_RUN",
        newValue: {
          intakeStage: nextStage,
          issues,
          note: dto.note || null
        }
      }
    });

    return {
      studentId,
      stage: nextStage,
      issues
    };
  }

  async replaceStudentPhoto(actor: AuthenticatedUser, studentId: string, dto: ReplaceStudentPhotoDto) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student || student.deletedAt) throw new NotFoundException("Student not found");
    await this.assertSchoolAccess(actor, student.schoolId);

    const photo = await this.faceIntelligenceService.processPhoto({
      photoDataUrl: dto.photoDataUrl,
      photoKey: dto.photoKey,
      schoolId: student.schoolId,
      intakeToken: student.intakeLinkId || student.id
    });

    const updated = await this.prisma.student.update({
      where: { id: studentId },
      data: {
        photoKey: photo.photoKey,
        photoQualityStatus: photo.photoQualityStatus,
        photoQualityScore: photo.photoQualityScore,
        photoAnalysisJson: photo.photoAnalysisJson as Prisma.InputJsonValue,
        intakeStage: IntakeSubmissionStage.SALES_CORRECTED,
        correctedAt: new Date()
      }
    });

    const correctionLog = await this.prisma.correctionLog.create({
      data: {
        schoolId: student.schoolId,
        studentId,
        actorUserId: actor.sub,
        reason: `Photo replace: ${dto.reason.trim()}`,
        beforeJson: this.sanitizeAuditPayload(JSON.parse(JSON.stringify(student))),
        afterJson: this.sanitizeAuditPayload(JSON.parse(JSON.stringify(updated)))
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "STUDENT",
        entityId: studentId,
        action: "PHOTO_REPLACED",
        oldValue: this.sanitizeAuditPayload(JSON.parse(JSON.stringify(student))),
        newValue: this.sanitizeAuditPayload(JSON.parse(JSON.stringify(updated)))
      }
    });

    return { updated, correctionLogId: correctionLog.id };
  }

  async mergeDuplicate(actor: AuthenticatedUser, sourceStudentId: string, dto: MergeDuplicateDto) {
    if (sourceStudentId === dto.targetStudentId) {
      throw new BadRequestException("Source and target students cannot be same");
    }

    const [source, target] = await Promise.all([
      this.prisma.student.findUnique({ where: { id: sourceStudentId } }),
      this.prisma.student.findUnique({ where: { id: dto.targetStudentId } })
    ]);
    if (!source || source.deletedAt) throw new NotFoundException("Source student not found");
    if (!target || target.deletedAt) throw new NotFoundException("Target student not found");
    if (source.schoolId !== target.schoolId) {
      throw new BadRequestException("Duplicate merge requires students from same school");
    }
    await this.assertSchoolAccess(actor, source.schoolId);

    const mergedData: Prisma.StudentUpdateInput = {
      fullName: target.fullName || source.fullName,
      parentName: target.parentName || source.parentName,
      parentMobile: target.parentMobile || source.parentMobile,
      className: target.className || source.className,
      section: target.section || source.section,
      rollNumber: target.rollNumber || source.rollNumber,
      address: target.address || source.address,
      photoKey: dto.preferSourcePhoto ? source.photoKey : target.photoKey,
      duplicateFlag: false,
      intakeStage: IntakeSubmissionStage.SALES_CORRECTED,
      correctedAt: new Date()
    };

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedTarget = await tx.student.update({
        where: { id: target.id },
        data: mergedData
      });

      const sourceArchived = await tx.student.update({
        where: { id: source.id },
        data: {
          deletedAt: new Date(),
          status: StudentStatus.REJECTED,
          intakeStage: IntakeSubmissionStage.REJECTED,
          rejectionNote: `Merged into ${target.id}`
        }
      });

      await tx.parentSubmission.updateMany({
        where: { studentId: source.id },
        data: {
          studentId: target.id
        }
      });

      await tx.proof.updateMany({
        where: { studentId: source.id },
        data: { status: "MERGED" }
      });

      const correctionLog = await tx.correctionLog.create({
        data: {
          schoolId: source.schoolId,
          studentId: target.id,
          actorUserId: actor.sub,
          reason: `Duplicate merge: ${dto.reason.trim()}`,
          beforeJson: this.sanitizeAuditPayload({
            source: JSON.parse(JSON.stringify(source)),
            target: JSON.parse(JSON.stringify(target))
          } as Prisma.InputJsonValue),
          afterJson: this.sanitizeAuditPayload({
            target: JSON.parse(JSON.stringify(updatedTarget)),
            sourceArchived: JSON.parse(JSON.stringify(sourceArchived))
          } as Prisma.InputJsonValue)
        }
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.sub,
          entityType: "STUDENT",
          entityId: target.id,
          action: "DUPLICATE_MERGED",
          oldValue: this.sanitizeAuditPayload(JSON.parse(JSON.stringify(source))),
          newValue: {
            sourceStudentId: source.id,
            targetStudentId: target.id,
            reason: dto.reason,
            preferSourcePhoto: dto.preferSourcePhoto || false
          } as Prisma.InputJsonValue
        }
      });

      return { updatedTarget, sourceArchived, correctionLogId: correctionLog.id };
    });

    return result;
  }

  async handoffStudent(actor: AuthenticatedUser, studentId: string, dto: HandoffStudentDto) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student || student.deletedAt) throw new NotFoundException("Student not found");
    await this.assertSchoolAccess(actor, student.schoolId);

    const allowedStages = new Set<IntakeSubmissionStage>([
      IntakeSubmissionStage.AWAITING_INSTITUTION_APPROVAL,
      IntakeSubmissionStage.APPROVED_FOR_DESIGN,
      IntakeSubmissionStage.DESIGN_READY,
      IntakeSubmissionStage.APPROVED_FOR_PRINT
    ]);
    if (!allowedStages.has(dto.toStage)) {
      throw new BadRequestException("Unsupported handoff stage for Phase 3 flow");
    }

    const mappedStatus: StudentStatus =
      dto.toStage === IntakeSubmissionStage.APPROVED_FOR_PRINT
        ? StudentStatus.SALES_APPROVED
        : dto.toStage === IntakeSubmissionStage.APPROVED_FOR_DESIGN
          ? StudentStatus.SCHOOL_APPROVED
          : student.status;

    const updated = await this.prisma.student.update({
      where: { id: studentId },
      data: {
        intakeStage: dto.toStage,
        status: mappedStatus
      }
    });

    await this.prisma.correctionLog.create({
      data: {
        schoolId: student.schoolId,
        studentId,
        actorUserId: actor.sub,
        reason: `Handoff to ${dto.toStage}${dto.note ? `: ${dto.note}` : ""}`,
        beforeJson: JSON.parse(JSON.stringify(student)),
        afterJson: JSON.parse(JSON.stringify(updated))
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "STUDENT",
        entityId: studentId,
        action: "CORRECTION_HANDOFF",
        newValue: {
          toStage: dto.toStage,
          mappedStatus,
          note: dto.note || null
        }
      }
    });

    return updated;
  }

  async listApprovalChains(actor: AuthenticatedUser, schoolId: string, institutionType?: InstitutionType) {
    await this.assertSchoolAccess(actor, schoolId);
    return this.prisma.approvalChain.findMany({
      where: {
        schoolId,
        deletedAt: null,
        ...(institutionType ? { institutionType } : {})
      },
      include: {
        steps: {
          orderBy: { stepOrder: "asc" },
          select: {
            id: true,
            stepOrder: true,
            role: true,
            label: true,
            isOptional: true,
            slaHours: true
          }
        }
      },
      orderBy: [{ institutionType: "asc" }, { isActive: "desc" }, { version: "desc" }]
    });
  }

  async createApprovalChain(actor: AuthenticatedUser, schoolId: string, dto: CreateApprovalChainDto) {
    await this.assertSchoolAccess(actor, schoolId);
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, institutionType: true }
    });
    if (!school) throw new NotFoundException("School not found");
    if (dto.institutionType !== school.institutionType) {
      throw new BadRequestException(
        `Institution type mismatch. School is ${school.institutionType}, received ${dto.institutionType}`
      );
    }

    const normalizedSteps = this.normalizeApprovalChainSteps(dto.steps);
    const latestChain = await this.prisma.approvalChain.findFirst({
      where: { schoolId, institutionType: dto.institutionType },
      orderBy: { version: "desc" },
      select: { version: true }
    });
    const nextVersion = (latestChain?.version ?? 0) + 1;
    const activate = dto.isActive ?? true;

    const chain = await this.prisma.$transaction(async (tx) => {
      if (activate) {
        await tx.approvalChain.updateMany({
          where: { schoolId, institutionType: dto.institutionType, deletedAt: null, isActive: true },
          data: { isActive: false }
        });
      }

      return tx.approvalChain.create({
        data: {
          schoolId,
          institutionType: dto.institutionType,
          name: dto.name.trim(),
          isActive: activate,
          version: nextVersion,
          createdById: actor.sub,
          steps: {
            create: normalizedSteps.map((step, index) => ({
              stepOrder: index + 1,
              role: step.role,
              label: step.label || null,
              isOptional: step.isOptional,
              slaHours: step.slaHours || null
            }))
          }
        },
        include: {
          steps: {
            orderBy: { stepOrder: "asc" },
            select: {
              id: true,
              stepOrder: true,
              role: true,
              label: true,
              isOptional: true,
              slaHours: true
            }
          }
        }
      });
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "APPROVAL_CHAIN",
        entityId: chain.id,
        action: "CREATE",
        newValue: {
          schoolId,
          institutionType: chain.institutionType,
          isActive: chain.isActive,
          version: chain.version,
          steps: chain.steps.map((s) => ({
            stepOrder: s.stepOrder,
            role: s.role,
            label: s.label,
            isOptional: s.isOptional,
            slaHours: s.slaHours
          }))
        } as Prisma.InputJsonValue
      }
    });

    return chain;
  }

  async activateApprovalChain(actor: AuthenticatedUser, chainId: string, dto: ActivateApprovalChainDto) {
    const chain = await this.prisma.approvalChain.findUnique({
      where: { id: chainId },
      select: { id: true, schoolId: true, institutionType: true, isActive: true, deletedAt: true }
    });
    if (!chain || chain.deletedAt) throw new NotFoundException("Approval chain not found");
    await this.assertSchoolAccess(actor, chain.schoolId);

    const deactivateOthers = dto.deactivateOthers ?? true;
    await this.prisma.$transaction(async (tx) => {
      if (deactivateOthers) {
        await tx.approvalChain.updateMany({
          where: {
            schoolId: chain.schoolId,
            institutionType: chain.institutionType,
            id: { not: chain.id },
            deletedAt: null
          },
          data: { isActive: false }
        });
      }

      await tx.approvalChain.update({
        where: { id: chain.id },
        data: { isActive: true }
      });
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "APPROVAL_CHAIN",
        entityId: chain.id,
        action: "ACTIVATE",
        oldValue: { isActive: chain.isActive } as Prisma.InputJsonValue,
        newValue: { isActive: true, deactivateOthers } as Prisma.InputJsonValue
      }
    });

    return this.prisma.approvalChain.findUnique({
      where: { id: chain.id },
      include: {
        steps: {
          orderBy: { stepOrder: "asc" },
          select: {
            id: true,
            stepOrder: true,
            role: true,
            label: true,
            isOptional: true,
            slaHours: true
          }
        }
      }
    });
  }

  async listApprovalWorkflows(actor: AuthenticatedUser, query: ApprovalWorkflowQuery) {
    const scopedSchoolIds = this.resolveScopedSchoolIds(actor, query.schoolId);
    const page = Math.max(Number(query.page || 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 200);

    const where: Prisma.ApprovalWorkflowWhereInput = {
      ...(scopedSchoolIds ? { schoolId: { in: scopedSchoolIds } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.chainId ? { chainId: query.chainId } : {})
    };

    const [rows, total] = await Promise.all([
      this.prisma.approvalWorkflow.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          school: { select: { id: true, name: true, code: true, institutionType: true } },
          student: {
            select: {
              id: true,
              fullName: true,
              className: true,
              section: true,
              rollNumber: true,
              intakeStage: true,
              status: true
            }
          },
          chain: { select: { id: true, name: true, version: true, institutionType: true } },
          currentStep: { select: { id: true, stepOrder: true, role: true, label: true } },
          startedBy: { select: { id: true, email: true, role: true } },
          decidedBy: { select: { id: true, email: true, role: true } },
          _count: { select: { actions: true } }
        }
      }),
      this.prisma.approvalWorkflow.count({ where })
    ]);

    return {
      page,
      pageSize,
      total,
      rows
    };
  }

  async getApprovalWorkflow(actor: AuthenticatedUser, workflowId: string) {
    const workflow = await this.prisma.approvalWorkflow.findUnique({
      where: { id: workflowId },
      include: {
        school: { select: { id: true, name: true, code: true, institutionType: true } },
        student: {
          select: {
            id: true,
            fullName: true,
            className: true,
            section: true,
            rollNumber: true,
            parentName: true,
            parentNameCiphertext: true,
            parentMobile: true,
            parentMobileCiphertext: true,
            intakeStage: true,
            status: true
          }
        },
        chain: {
          select: {
            id: true,
            name: true,
            version: true,
            institutionType: true,
            steps: {
              orderBy: { stepOrder: "asc" },
              select: {
                id: true,
                stepOrder: true,
                role: true,
                label: true,
                isOptional: true,
                slaHours: true
              }
            }
          }
        },
        currentStep: {
          select: { id: true, stepOrder: true, role: true, label: true, isOptional: true, slaHours: true }
        },
        startedBy: { select: { id: true, email: true, role: true } },
        decidedBy: { select: { id: true, email: true, role: true } },
        actions: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            action: true,
            comment: true,
            fromStatus: true,
            toStatus: true,
            createdAt: true,
            step: { select: { id: true, stepOrder: true, role: true, label: true } },
            actorUser: { select: { id: true, email: true, role: true } }
          }
        }
      }
    });
    if (!workflow) throw new NotFoundException("Approval workflow not found");
    this.resolveScopedSchoolIds(actor, workflow.schoolId);
    return {
      ...workflow,
      student: workflow.student ? this.maskStudentSummary(actor, workflow.student) : workflow.student
    };
  }

  async startApprovalWorkflow(actor: AuthenticatedUser, studentId: string, dto: StartApprovalWorkflowDto) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        school: {
          select: { id: true, name: true, code: true, institutionType: true }
        }
      }
    });
    if (!student || student.deletedAt) throw new NotFoundException("Student not found");
    this.resolveScopedSchoolIds(actor, student.schoolId);

    const chain = dto.chainId
      ? await this.prisma.approvalChain.findUnique({
          where: { id: dto.chainId },
          include: { steps: { orderBy: { stepOrder: "asc" } } }
        })
      : await this.prisma.approvalChain.findFirst({
          where: {
            schoolId: student.schoolId,
            institutionType: student.school.institutionType,
            isActive: true,
            deletedAt: null
          },
          orderBy: [{ version: "desc" }, { updatedAt: "desc" }],
          include: { steps: { orderBy: { stepOrder: "asc" } } }
        });

    if (!chain || chain.deletedAt) throw new BadRequestException("Active approval chain not found for this school");
    if (chain.schoolId !== student.schoolId) {
      throw new BadRequestException("Selected approval chain does not belong to this school");
    }
    if (chain.steps.length === 0) {
      throw new BadRequestException("Approval chain has no steps configured");
    }

    const openWorkflows = await this.prisma.approvalWorkflow.findMany({
      where: {
        studentId: student.id,
        status: { in: [ApprovalWorkflowStatus.PENDING, ApprovalWorkflowStatus.IN_PROGRESS, ApprovalWorkflowStatus.SENT_BACK, ApprovalWorkflowStatus.ON_HOLD] }
      },
      select: { id: true, status: true }
    });
    if (openWorkflows.length > 0 && !dto.forceRestart) {
      throw new ConflictException("Student already has an active approval workflow. Use forceRestart to create a new one.");
    }

    const note = dto.note?.trim();
    const firstStep = chain.steps[0];
    const now = new Date();

    const workflow = await this.prisma.$transaction(async (tx) => {
      if (openWorkflows.length > 0 && dto.forceRestart) {
        for (const active of openWorkflows) {
          await tx.approvalWorkflow.update({
            where: { id: active.id },
            data: {
              status: ApprovalWorkflowStatus.ON_HOLD,
              currentStepId: null,
              decidedById: actor.sub,
              decidedAt: now,
              latestComment: "Workflow put on hold by force restart"
            }
          });
          await tx.approvalWorkflowAction.create({
            data: {
              workflowId: active.id,
              actorUserId: actor.sub,
              action: ApprovalActionType.COMMENT,
              comment: "Workflow put on hold by force restart",
              fromStatus: active.status,
              toStatus: ApprovalWorkflowStatus.ON_HOLD
            }
          });
        }
      }

      const created = await tx.approvalWorkflow.create({
        data: {
          schoolId: student.schoolId,
          studentId: student.id,
          chainId: chain.id,
          currentStepId: firstStep.id,
          status: ApprovalWorkflowStatus.IN_PROGRESS,
          startedById: actor.sub,
          latestComment: note || null,
          metadataJson: dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : undefined
        },
        include: {
          currentStep: { select: { id: true, stepOrder: true, role: true, label: true } }
        }
      });

      await tx.approvalWorkflowAction.create({
        data: {
          workflowId: created.id,
          stepId: firstStep.id,
          actorUserId: actor.sub,
          action: ApprovalActionType.COMMENT,
          comment: note || `Workflow started at step ${firstStep.stepOrder} (${firstStep.role})`,
          fromStatus: ApprovalWorkflowStatus.PENDING,
          toStatus: ApprovalWorkflowStatus.IN_PROGRESS
        }
      });

      await tx.approvalRequest.create({
        data: {
          schoolId: student.schoolId,
          approvalWorkflowId: created.id,
          type: ApprovalRequestType.DATA_AND_DESIGN_APPROVAL,
          status: ApprovalRequestStatus.PENDING,
          requestedByUserId: actor.sub,
          requestedAt: now
        }
      });

      await tx.student.update({
        where: { id: student.id },
        data: {
          intakeStage: IntakeSubmissionStage.AWAITING_INSTITUTION_APPROVAL,
          status: student.status === StudentStatus.DRAFT ? StudentStatus.SUBMITTED : student.status
        }
      });

      const withStudent = await tx.approvalWorkflow.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          currentStep: { select: { id: true, stepOrder: true, role: true, label: true } },
          chain: { select: { id: true, name: true, version: true, institutionType: true } },
          student: {
            select: {
              id: true,
              fullName: true,
              className: true,
              section: true,
              rollNumber: true,
              intakeStage: true,
              status: true
            }
          }
        }
      });

      return withStudent;
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "APPROVAL_WORKFLOW",
        entityId: workflow.id,
        action: "START",
        newValue: {
          schoolId: student.schoolId,
          studentId: student.id,
          chainId: chain.id,
          firstStepRole: firstStep.role,
          forceRestart: dto.forceRestart || false,
          note: note || null
        } as Prisma.InputJsonValue
      }
    });

    return workflow;
  }

  async actOnApprovalWorkflow(actor: AuthenticatedUser, workflowId: string, dto: ApprovalWorkflowActionDto) {
    return this.applyApprovalWorkflowAction(actor, workflowId, dto);
  }

  async bulkActOnApprovalWorkflow(actor: AuthenticatedUser, dto: BulkApprovalWorkflowActionDto) {
    const continueOnError = dto.continueOnError ?? true;
    const uniqueWorkflowIds = [...new Set(dto.workflowIds.map((id) => id.trim()).filter(Boolean))];
    if (uniqueWorkflowIds.length === 0) {
      throw new BadRequestException("workflowIds are required");
    }

    const success: Array<{ workflowId: string; status: ApprovalWorkflowStatus; currentStepId: string | null }> = [];
    const failed: Array<{ workflowId: string; error: string }> = [];

    for (const workflowId of uniqueWorkflowIds) {
      try {
        const result = await this.applyApprovalWorkflowAction(actor, workflowId, {
          action: dto.action,
          comment: dto.comment
        });
        success.push({
          workflowId: result.id,
          status: result.status,
          currentStepId: result.currentStepId
        });
      } catch (error) {
        failed.push({
          workflowId,
          error: error instanceof Error ? error.message : "Unknown error"
        });
        if (!continueOnError) break;
      }
    }

    return {
      action: dto.action,
      requested: uniqueWorkflowIds.length,
      successCount: success.length,
      failedCount: failed.length,
      success,
      failed
    };
  }

  async createTemplate(actor: AuthenticatedUser, schoolId: string, dto: CreateTemplateDto) {
    await this.assertSchoolAccess(actor, schoolId);
    const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { id: true } });
    if (!school) throw new NotFoundException("School not found");

    if (dto.isActive || dto.isDefault) {
      await this.prisma.template.updateMany({
        where: { schoolId, OR: [{ isActive: true }, { isDefault: true }] },
        data: { isActive: false, isDefault: false }
      });
    }

    const templateCode =
      dto.templateCode?.trim() ||
      `${dto.name
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 20)}-${randomBytes(2).toString("hex").toUpperCase()}`;

    const template = await this.prisma.template.create({
      data: {
        schoolId,
        templateCode,
        name: dto.name.trim(),
        institutionType: dto.institutionType ?? InstitutionType.SCHOOL,
        cardType: dto.cardType ?? TemplateCardType.STUDENT,
        orientation: dto.orientation ?? CardOrientation.PORTRAIT,
        cardWidthMm: dto.cardWidthMm ?? null,
        cardHeightMm: dto.cardHeightMm ?? null,
        frontDesignUrl: dto.frontDesignUrl?.trim(),
        backDesignUrl: dto.backDesignUrl?.trim(),
        frontLayoutJson: (dto.frontLayoutJson as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        backLayoutJson: (dto.backLayoutJson as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        mappingJson: dto.mappingJson as Prisma.InputJsonValue,
        status: dto.status ?? (dto.isActive ? TemplateLifecycleStatus.PUBLISHED : TemplateLifecycleStatus.DRAFT),
        isActive: dto.isActive ?? false,
        isDefault: dto.isDefault ?? false,
        notes: dto.notes?.trim(),
        createdById: actor.sub,
        updatedById: actor.sub,
        version: 1
      }
    });

    await this.prisma.templateSnapshot.create({
      data: {
        templateId: template.id,
        version: 1,
        status: template.status,
        mappingJson: dto.mappingJson as Prisma.InputJsonValue,
        frontDesignUrl: template.frontDesignUrl,
        backDesignUrl: template.backDesignUrl,
        frontLayoutJson: (dto.frontLayoutJson as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        backLayoutJson: (dto.backLayoutJson as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        notes: dto.notes?.trim(),
        createdById: actor.sub
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "TEMPLATE",
        entityId: template.id,
        action: "CREATE",
        newValue: {
          schoolId,
          templateCode: template.templateCode,
          name: template.name,
          status: template.status,
          isActive: template.isActive,
          isDefault: template.isDefault
        }
      }
    });

    return this.getTemplate(actor, template.id);
  }

  async listTemplates(actor: AuthenticatedUser, schoolId: string) {
    await this.assertSchoolAccess(actor, schoolId);
    return this.prisma.template.findMany({
      where: { schoolId, deletedAt: null },
      orderBy: [{ isDefault: "desc" }, { isActive: "desc" }, { updatedAt: "desc" }],
      include: {
        createdBy: { select: { id: true, email: true, role: true } },
        updatedBy: { select: { id: true, email: true, role: true } },
        assignments: {
          where: { deletedAt: null, isActive: true },
          orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
          take: 5,
          select: {
            id: true,
            scope: true,
            className: true,
            section: true,
            cardType: true,
            intakeLinkId: true,
            isDefault: true
          }
        },
        snapshots: {
          take: 1,
          orderBy: { version: "desc" },
          select: { id: true, version: true, status: true, createdAt: true }
        }
      }
    });
  }

  async getTemplate(actor: AuthenticatedUser, templateId: string) {
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
      include: {
        school: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, email: true, role: true } },
        updatedBy: { select: { id: true, email: true, role: true } },
        assignments: {
          where: { deletedAt: null },
          orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
          include: {
            createdBy: { select: { id: true, email: true, role: true } },
            updatedBy: { select: { id: true, email: true, role: true } },
            intakeLink: { select: { id: true, token: true, className: true, section: true, campaignName: true } }
          }
        },
        snapshots: {
          orderBy: { version: "desc" },
          take: 20,
          select: {
            id: true,
            version: true,
            status: true,
            notes: true,
            createdAt: true,
            createdBy: { select: { id: true, email: true, role: true } }
          }
        }
      }
    });
    if (!template || template.deletedAt) throw new NotFoundException("Template not found");
    await this.assertSchoolAccess(actor, template.schoolId);
    return template;
  }

  async activateTemplate(actor: AuthenticatedUser, templateId: string, dto: ActivateTemplateDto) {
    return this.updateTemplateStatus(actor, templateId, {
      status: TemplateLifecycleStatus.PUBLISHED,
      deactivateOthers: dto.deactivateOthers
    });
  }

  async duplicateTemplate(actor: AuthenticatedUser, templateId: string, dto: DuplicateTemplateDto) {
    const template = await this.prisma.template.findUnique({ where: { id: templateId } });
    if (!template || template.deletedAt) throw new NotFoundException("Template not found");
    await this.assertSchoolAccess(actor, template.schoolId);

    const templateCode =
      dto.templateCode?.trim() ||
      `${(template.templateCode || template.name)
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 20)}-${randomBytes(2).toString("hex").toUpperCase()}`;

    const duplicated = await this.prisma.template.create({
      data: {
        schoolId: template.schoolId,
        templateCode,
        name: dto.name?.trim() || `${template.name} Copy`,
        institutionType: template.institutionType,
        cardType: template.cardType,
        orientation: template.orientation,
        cardWidthMm: template.cardWidthMm,
        cardHeightMm: template.cardHeightMm,
        frontDesignUrl: template.frontDesignUrl,
        backDesignUrl: template.backDesignUrl,
        frontLayoutJson: (template.frontLayoutJson as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        backLayoutJson: (template.backLayoutJson as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        mappingJson: template.mappingJson as Prisma.InputJsonValue,
        status: TemplateLifecycleStatus.DRAFT,
        version: 1,
        isDefault: false,
        isActive: false,
        engineVersion: 1,
        lastSnapshotVersion: 1,
        notes: dto.notes?.trim() || template.notes,
        createdById: actor.sub,
        updatedById: actor.sub
      }
    });

    await this.prisma.templateSnapshot.create({
      data: {
        templateId: duplicated.id,
        version: 1,
        status: TemplateLifecycleStatus.DRAFT,
        mappingJson: duplicated.mappingJson as Prisma.InputJsonValue,
        frontDesignUrl: duplicated.frontDesignUrl,
        backDesignUrl: duplicated.backDesignUrl,
        frontLayoutJson: (duplicated.frontLayoutJson as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        backLayoutJson: (duplicated.backLayoutJson as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        notes: duplicated.notes,
        createdById: actor.sub
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "TEMPLATE",
        entityId: duplicated.id,
        action: "DUPLICATE",
        oldValue: { sourceTemplateId: template.id } as Prisma.InputJsonValue,
        newValue: {
          templateCode: duplicated.templateCode,
          status: duplicated.status
        } as Prisma.InputJsonValue
      }
    });

    return this.getTemplate(actor, duplicated.id);
  }

  async updateTemplateStatus(actor: AuthenticatedUser, templateId: string, dto: UpdateTemplateStatusDto) {
    const template = await this.prisma.template.findUnique({ where: { id: templateId } });
    if (!template || template.deletedAt) throw new NotFoundException("Template not found");
    await this.assertSchoolAccess(actor, template.schoolId);

    const nextStatus = dto.status;
    const deactivateOthers = dto.deactivateOthers ?? true;
    const nextSnapshotVersion = (template.lastSnapshotVersion || 1) + 1;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (nextStatus === TemplateLifecycleStatus.PUBLISHED && deactivateOthers) {
        await tx.template.updateMany({
          where: {
            schoolId: template.schoolId,
            id: { not: template.id },
            cardType: template.cardType
          },
          data: {
            isActive: false,
            isDefault: false
          }
        });
      }

      const item = await tx.template.update({
        where: { id: template.id },
        data: {
          status: nextStatus,
          isActive: nextStatus === TemplateLifecycleStatus.PUBLISHED,
          isDefault:
            nextStatus === TemplateLifecycleStatus.ARCHIVED ? false : nextStatus === TemplateLifecycleStatus.PUBLISHED ? true : template.isDefault,
          archivedAt: nextStatus === TemplateLifecycleStatus.ARCHIVED ? new Date() : null,
          notes: dto.notes?.trim() || template.notes,
          updatedById: actor.sub,
          version: { increment: 1 },
          lastSnapshotVersion: nextSnapshotVersion
        }
      });

      await tx.templateSnapshot.create({
        data: {
          templateId: template.id,
          version: nextSnapshotVersion,
          status: nextStatus,
          mappingJson: template.mappingJson as Prisma.InputJsonValue,
          frontDesignUrl: template.frontDesignUrl,
          backDesignUrl: template.backDesignUrl,
          frontLayoutJson: (template.frontLayoutJson as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          backLayoutJson: (template.backLayoutJson as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          notes: dto.notes?.trim() || template.notes,
          createdById: actor.sub
        }
      });

      return item;
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "TEMPLATE",
        entityId: template.id,
        action: "STATUS_UPDATE",
        oldValue: { status: template.status } as Prisma.InputJsonValue,
        newValue: {
          status: nextStatus,
          deactivateOthers
        } as Prisma.InputJsonValue
      }
    });

    return {
      message: "Template status updated",
      template: updated
    };
  }

  async updateTemplateMapping(actor: AuthenticatedUser, templateId: string, dto: UpdateTemplateMappingDto) {
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
      include: { school: { select: { id: true, name: true } } }
    });
    if (!template || template.deletedAt) throw new NotFoundException("Template not found");
    await this.assertSchoolAccess(actor, template.schoolId);

    const nextMapping = (dto.mappingJson ?? (template.mappingJson as Record<string, unknown>)) as Record<
      string,
      unknown
    >;
    const nextFrontLayout = (dto.frontLayoutJson ??
      (template.frontLayoutJson as Record<string, unknown> | null) ??
      {}) as Record<string, unknown>;
    const nextBackLayout = (dto.backLayoutJson ??
      (template.backLayoutJson as Record<string, unknown> | null) ??
      {}) as Record<string, unknown>;

    const validation = this.templateRenderService.validateTemplateDefinition({
      mappingJson: nextMapping,
      frontLayoutJson: nextFrontLayout,
      backLayoutJson: nextBackLayout
    });
    if (validation.errors.length) {
      throw new BadRequestException({
        message: "Template mapping/layout validation failed",
        errors: validation.errors
      });
    }

    const nextVersion = (template.lastSnapshotVersion || 1) + 1;
    const oldMapping = template.mappingJson;

    const updatedTemplate = await this.prisma.$transaction(async (tx) => {
      const snapshot = await tx.templateSnapshot.create({
        data: {
          templateId: template.id,
          version: nextVersion,
          status: dto.status ?? template.status,
          mappingJson: nextMapping as Prisma.InputJsonValue,
          frontDesignUrl: dto.frontDesignUrl ?? template.frontDesignUrl,
          backDesignUrl: dto.backDesignUrl ?? template.backDesignUrl,
          frontLayoutJson: nextFrontLayout as Prisma.InputJsonValue,
          backLayoutJson: nextBackLayout as Prisma.InputJsonValue,
          notes: dto.notes?.trim() || template.notes,
          createdById: actor.sub
        }
      });

      const updated = await tx.template.update({
        where: { id: template.id },
        data: {
          mappingJson: nextMapping as Prisma.InputJsonValue,
          frontDesignUrl: dto.frontDesignUrl ?? template.frontDesignUrl,
          backDesignUrl: dto.backDesignUrl ?? template.backDesignUrl,
          frontLayoutJson: nextFrontLayout as Prisma.InputJsonValue,
          backLayoutJson: nextBackLayout as Prisma.InputJsonValue,
          status: dto.status ?? template.status,
          notes: dto.notes?.trim() || template.notes,
          updatedById: actor.sub,
          version: { increment: 1 },
          engineVersion: { increment: 1 },
          lastSnapshotVersion: snapshot.version
        }
      });

      return updated;
    });

    const proofs = await this.prisma.proof.findMany({
      where: {
        templateId: template.id,
        ...(dto.lockApprovedProofs ? { approvedBySchool: false } : {})
      },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            className: true,
            section: true,
            rollNumber: true,
            parentName: true,
            parentNameCiphertext: true,
            parentMobile: true,
            parentMobileCiphertext: true,
            address: true,
            addressCiphertext: true
          }
        },
        school: { select: { name: true, code: true } }
      }
    });

    const updates = proofs.map((proof) => {
      const student = this.hydrateStudentSensitiveFields(proof.student);
      return this.prisma.proof.update({
        where: { id: proof.id },
        data: {
          previewJson: this.templateRenderService.buildPreviewPayload(
            nextMapping,
            student,
            proof.school,
            nextVersion,
            {
              side: "both",
              layout: {
                front: nextFrontLayout,
                back: nextBackLayout
              }
            }
          ) as Prisma.InputJsonValue,
          status: proof.approvedBySchool ? proof.status : "REGENERATED"
        }
      });
    });
    if (updates.length) {
      await this.prisma.$transaction(updates);
    }

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "TEMPLATE",
        entityId: template.id,
        action: "MAPPING_UPDATE",
        oldValue: oldMapping as Prisma.InputJsonValue,
        newValue: {
          mappingJson: nextMapping,
          status: dto.status ?? template.status,
          warnings: validation.warnings
        } as Prisma.InputJsonValue
      }
    });

    return {
      template: updatedTemplate,
      rebind: {
        updatedProofs: updates.length,
        templateVersion: nextVersion,
        warnings: validation.warnings
      },
      validation
    };
  }

  async renderTemplatePreview(
    actor: AuthenticatedUser,
    templateId: string,
    dto: RenderTemplatePreviewDto
  ) {
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
      include: { school: { select: { id: true, name: true, code: true, email: true } } }
    });
    if (!template || template.deletedAt) throw new NotFoundException("Template not found");
    await this.assertSchoolAccess(actor, template.schoolId);

    type TemplatePreviewStudent = {
      id: string;
      fullName: string;
      className: string;
      section: string;
      rollNumber: string;
      parentName: string;
      parentNameCiphertext: string | null;
      parentMobile: string;
      parentMobileCiphertext: string | null;
      address: string;
      addressCiphertext: string | null;
      schoolId: string;
    };

    let student: TemplatePreviewStudent | null = null;
    if (dto.studentId) {
      student = await this.prisma.student.findUnique({
        where: { id: dto.studentId },
        select: {
          id: true,
          fullName: true,
          className: true,
          section: true,
          rollNumber: true,
          parentName: true,
          parentNameCiphertext: true,
          parentMobile: true,
          parentMobileCiphertext: true,
          address: true,
          addressCiphertext: true,
          schoolId: true
        }
      });
    }

    if (!student) {
      student = {
        id: "demo-student",
        fullName: "Demo Student",
        className: "10",
        section: "A",
        rollNumber: "101",
        parentName: "Parent Demo",
        parentNameCiphertext: null,
        parentMobile: "9000000000",
        parentMobileCiphertext: null,
        address: "Demo Address",
        addressCiphertext: null,
        schoolId: template.schoolId
      };
    }
    student = this.hydrateStudentSensitiveFields(student);
    if (student.schoolId !== template.schoolId) {
      throw new BadRequestException("Student does not belong to template school");
    }

    const validation = this.templateRenderService.validateTemplateDefinition({
      mappingJson: template.mappingJson as Record<string, unknown>,
      frontLayoutJson: (template.frontLayoutJson as Record<string, unknown>) || {},
      backLayoutJson: (template.backLayoutJson as Record<string, unknown>) || {}
    });
    if (validation.errors.length) {
      throw new BadRequestException({
        message: "Template definition is invalid",
        errors: validation.errors
      });
    }

    const studentPreviewSource = dto.overrideFields
      ? ({
          ...student,
          ...dto.overrideFields
        } as typeof student)
      : student;

    return {
      templateId: template.id,
      templateVersion: template.lastSnapshotVersion,
      status: template.status,
      side: dto.side || "both",
      validation: dto.includeWarnings === false ? undefined : validation,
      preview: this.templateRenderService.buildPreviewPayload(
        template.mappingJson as Record<string, unknown>,
        studentPreviewSource,
        template.school,
        template.lastSnapshotVersion || 1,
        {
          side: dto.side || "both",
          layout: {
            front: template.frontLayoutJson || null,
            back: template.backLayoutJson || null
          }
        }
      )
    };
  }

  async bindTemplateToCampaign(
    actor: AuthenticatedUser,
    templateId: string,
    dto: BindTemplateCampaignDto
  ) {
    const template = await this.prisma.template.findUnique({ where: { id: templateId } });
    if (!template || template.deletedAt) throw new NotFoundException("Template not found");
    await this.assertSchoolAccess(actor, template.schoolId);

    const campaign = await this.prisma.intakeLink.findUnique({ where: { id: dto.intakeLinkId } });
    if (!campaign || campaign.deletedAt) throw new NotFoundException("Campaign not found");
    if (campaign.schoolId !== template.schoolId) {
      throw new BadRequestException("Template and campaign must belong to the same school");
    }

    const updated = await this.prisma.intakeLink.update({
      where: { id: campaign.id },
      data: { templateId: template.id }
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "INTAKE_LINK",
        entityId: campaign.id,
        action: "TEMPLATE_BOUND",
        newValue: { templateId: template.id }
      }
    });

    return updated;
  }

  async rebindTemplateProofs(
    actor: AuthenticatedUser,
    templateId: string,
    dto: RebindTemplateProofsDto
  ) {
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
      include: { school: { select: { id: true, name: true, code: true, email: true } } }
    });
    if (!template || template.deletedAt) throw new NotFoundException("Template not found");
    await this.assertSchoolAccess(actor, template.schoolId);

    const students = (
      await this.prisma.student.findMany({
        where: {
          schoolId: template.schoolId,
          deletedAt: null,
          ...(dto.intakeLinkId ? { intakeLinkId: dto.intakeLinkId } : {})
        },
        select: {
          id: true,
          fullName: true,
          className: true,
          section: true,
          rollNumber: true,
          parentName: true,
          parentNameCiphertext: true,
          parentMobile: true,
          parentMobileCiphertext: true,
          address: true,
          addressCiphertext: true
        }
      })
    ).map((row) => this.hydrateStudentSensitiveFields(row));

    const existingProofs = await this.prisma.proof.findMany({
      where: { templateId: template.id, studentId: { in: students.map((s) => s.id) } },
      select: { id: true, studentId: true, approvedBySchool: true }
    });
    const proofMap = new Map(existingProofs.map((p) => [p.studentId, p]));

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    students.forEach((student) => {
      const previewJson = this.templateRenderService.buildPreviewPayload(
        template.mappingJson as Record<string, unknown>,
        student,
        template.school,
        template.lastSnapshotVersion || 1
      ) as Prisma.InputJsonValue;
      const existing = proofMap.get(student.id);
      if (!existing) {
        ops.push(
          this.prisma.proof.create({
            data: {
              schoolId: template.schoolId,
              studentId: student.id,
              templateId: template.id,
              previewJson,
              status: "GENERATED"
            }
          })
        );
      } else if (!dto.onlyUnapproved || !existing.approvedBySchool) {
        ops.push(
          this.prisma.proof.update({
            where: { id: existing.id },
            data: { previewJson, status: existing.approvedBySchool ? "APPROVED" : "REGENERATED" }
          })
        );
      }
    });

    if (ops.length) {
      await this.prisma.$transaction(ops);
    }

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "TEMPLATE",
        entityId: template.id,
        action: "PROOFS_REBOUND",
        newValue: {
          affected: ops.length,
          intakeLinkId: dto.intakeLinkId || null,
          onlyUnapproved: dto.onlyUnapproved || false
        }
      }
    });

    return {
      templateId: template.id,
      affectedProofs: ops.length
    };
  }

  async listTemplateAssignments(actor: AuthenticatedUser, schoolId: string) {
    await this.assertSchoolAccess(actor, schoolId);
    return this.prisma.templateAssignment.findMany({
      where: { schoolId, deletedAt: null },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      include: {
        template: {
          select: {
            id: true,
            templateCode: true,
            name: true,
            status: true,
            isActive: true,
            cardType: true
          }
        },
        intakeLink: {
          select: {
            id: true,
            campaignName: true,
            className: true,
            section: true
          }
        },
        createdBy: { select: { id: true, email: true, role: true } },
        updatedBy: { select: { id: true, email: true, role: true } }
      }
    });
  }

  async upsertTemplateAssignment(
    actor: AuthenticatedUser,
    schoolId: string,
    dto: UpsertTemplateAssignmentDto
  ) {
    await this.assertSchoolAccess(actor, schoolId);

    const template = await this.prisma.template.findUnique({
      where: { id: dto.templateId },
      select: { id: true, schoolId: true, cardType: true, institutionType: true, status: true, isActive: true }
    });
    if (!template || template.schoolId !== schoolId) {
      throw new BadRequestException("templateId must belong to this school");
    }
    if (!template.isActive && template.status !== TemplateLifecycleStatus.PUBLISHED) {
      throw new BadRequestException("Only active/published templates can be assigned");
    }

    let intakeLinkId: string | null = null;
    if (dto.intakeLinkId?.trim()) {
      const intakeLink = await this.prisma.intakeLink.findUnique({
        where: { id: dto.intakeLinkId.trim() },
        select: { id: true, schoolId: true }
      });
      if (!intakeLink || intakeLink.schoolId !== schoolId) {
        throw new BadRequestException("intakeLinkId does not belong to this school");
      }
      intakeLinkId = intakeLink.id;
    }

    const className = dto.className?.trim()?.toUpperCase() || null;
    const section = dto.section?.trim()?.toUpperCase() || null;
    const cardType = dto.cardType ?? template.cardType;
    const institutionType = dto.institutionType ?? template.institutionType;

    if (dto.scope === TemplateAssignmentScope.CAMPAIGN && !intakeLinkId) {
      throw new BadRequestException("CAMPAIGN scope requires intakeLinkId");
    }
    if (dto.scope === TemplateAssignmentScope.CLASS_SECTION && (!className || !section)) {
      throw new BadRequestException("CLASS_SECTION scope requires className and section");
    }

    const identityWhere: Prisma.TemplateAssignmentWhereInput = {
      schoolId,
      scope: dto.scope,
      cardType,
      deletedAt: null,
      ...(dto.scope === TemplateAssignmentScope.CAMPAIGN
        ? { intakeLinkId }
        : dto.scope === TemplateAssignmentScope.CLASS_SECTION
          ? { className, section }
          : dto.scope === TemplateAssignmentScope.CARD_TYPE
            ? {}
            : { institutionType })
    };

    const existing = await this.prisma.templateAssignment.findFirst({
      where: identityWhere,
      orderBy: { createdAt: "desc" }
    });

    if (dto.isDefault) {
      await this.prisma.templateAssignment.updateMany({
        where: {
          schoolId,
          scope: dto.scope,
          cardType,
          isDefault: true,
          deletedAt: null,
          ...(dto.scope === TemplateAssignmentScope.CAMPAIGN
            ? { intakeLinkId }
            : dto.scope === TemplateAssignmentScope.CLASS_SECTION
              ? { className, section }
              : {})
        },
        data: { isDefault: false, updatedById: actor.sub }
      });
    }

    const assignment = existing
      ? await this.prisma.templateAssignment.update({
          where: { id: existing.id },
          data: {
            templateId: dto.templateId,
            institutionType,
            intakeLinkId,
            className,
            section,
            cardType,
            isDefault: dto.isDefault ?? existing.isDefault,
            isActive: dto.isActive ?? true,
            priority: dto.priority ?? existing.priority,
            notes: dto.notes?.trim() || existing.notes,
            updatedById: actor.sub,
            deletedAt: null
          }
        })
      : await this.prisma.templateAssignment.create({
          data: {
            templateId: dto.templateId,
            schoolId,
            institutionType,
            scope: dto.scope,
            intakeLinkId,
            className,
            section,
            cardType,
            isDefault: dto.isDefault ?? false,
            isActive: dto.isActive ?? true,
            priority: dto.priority ?? 100,
            notes: dto.notes?.trim() || null,
            createdById: actor.sub,
            updatedById: actor.sub
          }
        });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "TEMPLATE_ASSIGNMENT",
        entityId: assignment.id,
        action: existing ? "UPDATE" : "CREATE",
        newValue: {
          scope: assignment.scope,
          templateId: assignment.templateId,
          cardType: assignment.cardType,
          intakeLinkId: assignment.intakeLinkId,
          className: assignment.className,
          section: assignment.section,
          priority: assignment.priority
        } as Prisma.InputJsonValue
      }
    });

    return assignment;
  }

  async resolveTemplateForContext(actor: AuthenticatedUser, schoolId: string, input: TemplateResolutionInput) {
    await this.assertSchoolAccess(actor, schoolId);

    const normalizedCardType =
      input.cardType && Object.values(TemplateCardType).includes(input.cardType as TemplateCardType)
        ? (input.cardType as TemplateCardType)
        : TemplateCardType.STUDENT;
    const className = input.className?.trim()?.toUpperCase();
    const section = input.section?.trim()?.toUpperCase();
    const intakeLinkId = input.intakeLinkId?.trim();

    const assignments = await this.prisma.templateAssignment.findMany({
      where: {
        schoolId,
        deletedAt: null,
        isActive: true,
        cardType: normalizedCardType
      },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      include: {
        template: {
          select: {
            id: true,
            templateCode: true,
            name: true,
            status: true,
            isActive: true,
            cardType: true,
            institutionType: true
          }
        }
      }
    });

    const pick = (scope: TemplateAssignmentScope, matcher: (row: (typeof assignments)[number]) => boolean) =>
      assignments.find((row) => row.scope === scope && matcher(row));

    const resolvedAssignment =
      pick(TemplateAssignmentScope.CAMPAIGN, (row) => !!intakeLinkId && row.intakeLinkId === intakeLinkId) ||
      pick(
        TemplateAssignmentScope.CLASS_SECTION,
        (row) => !!className && !!section && row.className === className && row.section === section
      ) ||
      pick(TemplateAssignmentScope.CARD_TYPE, () => true) ||
      pick(TemplateAssignmentScope.SCHOOL_DEFAULT, () => true) ||
      pick(TemplateAssignmentScope.ORG_DEFAULT, () => true);

    if (resolvedAssignment?.template && resolvedAssignment.template.isActive) {
      return {
        resolvedBy: "assignment",
        assignment: resolvedAssignment,
        template: resolvedAssignment.template
      };
    }

    const fallback = await this.prisma.template.findFirst({
      where: {
        schoolId,
        deletedAt: null,
        status: TemplateLifecycleStatus.PUBLISHED,
        isActive: true,
        cardType: normalizedCardType
      },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
    });

    return {
      resolvedBy: fallback ? "fallback" : "none",
      assignment: resolvedAssignment || null,
      template: fallback || null
    };
  }

  async createRenderBatch(actor: AuthenticatedUser, templateId: string, dto: CreateRenderBatchDto) {
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
      include: { school: { select: { id: true, name: true, code: true, email: true } } }
    });
    if (!template || template.deletedAt) throw new NotFoundException("Template not found");
    await this.assertSchoolAccess(actor, template.schoolId);

    const definitionValidation = this.templateRenderService.validateTemplateDefinition({
      mappingJson: template.mappingJson as Record<string, unknown>,
      frontLayoutJson: (template.frontLayoutJson as Record<string, unknown>) || {},
      backLayoutJson: (template.backLayoutJson as Record<string, unknown>) || {}
    });
    if (definitionValidation.errors.length) {
      throw new BadRequestException({
        message: "Template definition is invalid",
        errors: definitionValidation.errors
      });
    }

    const where: Prisma.StudentWhereInput = {
      schoolId: template.schoolId,
      deletedAt: null
    };
    if (dto.studentIds?.length) {
      where.id = { in: [...new Set(dto.studentIds.map((id) => id.trim()).filter(Boolean))] };
    }
    if (dto.intakeLinkId?.trim()) where.intakeLinkId = dto.intakeLinkId.trim();
    if (dto.className?.trim()) where.className = dto.className.trim().toUpperCase();
    if (dto.section?.trim()) where.section = dto.section.trim().toUpperCase();
    if (dto.studentStatus) where.status = dto.studentStatus;
    if (dto.onlyApproved) {
      where.status = {
        in: [
          StudentStatus.SCHOOL_APPROVED,
          StudentStatus.SALES_APPROVED,
          StudentStatus.IN_PRINT_QUEUE,
          StudentStatus.PRINTED,
          StudentStatus.DELIVERED
        ]
      };
    }

    const students = (
      await this.prisma.student.findMany({
        where,
        orderBy: [{ className: "asc" }, { section: "asc" }, { rollNumber: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          fullName: true,
          className: true,
          section: true,
          rollNumber: true,
          parentName: true,
          parentNameCiphertext: true,
          parentMobile: true,
          parentMobileCiphertext: true,
          address: true,
          addressCiphertext: true,
          photoKey: true,
          status: true,
          schoolId: true
        }
      })
    ).map((row) => this.hydrateStudentSensitiveFields(row));
    if (!students.length) throw new BadRequestException("No records found for render batch");

    const skipInvalid = dto.skipInvalid ?? true;
    const requiredTokens = definitionValidation.requiredTokens;
    let successCount = 0;
    let failedCount = 0;

    const batch = await this.prisma.renderBatch.create({
      data: {
        schoolId: template.schoolId,
        templateId: template.id,
        initiatedById: actor.sub,
        status: RenderBatchStatus.PROCESSING,
        mode: dto.studentIds?.length ? "SELECTED" : "FILTERED",
        filtersJson: {
          intakeLinkId: dto.intakeLinkId || null,
          className: dto.className || null,
          section: dto.section || null,
          studentStatus: dto.studentStatus || null,
          onlyApproved: dto.onlyApproved ?? false
        } as Prisma.InputJsonValue,
        optionsJson: {
          outputFormat: dto.outputFormat || "PDF",
          pageSize: dto.pageSize || "A4",
          grid: dto.grid || "3x8",
          sideMode: dto.sideMode || "FRONT_BACK",
          skipInvalid
        } as Prisma.InputJsonValue,
        totalRecords: students.length,
        startedAt: new Date()
      }
    });

    const itemOps: Prisma.PrismaPromise<unknown>[] = [];
    for (const student of students) {
      const recordValidation = this.templateRenderService.validateRecordForTemplate(requiredTokens, student);
      if (recordValidation.errors.length) {
        failedCount += 1;
        itemOps.push(
          this.prisma.renderBatchItem.create({
            data: {
              batchId: batch.id,
              studentId: student.id,
              status: skipInvalid ? RenderBatchItemStatus.SKIPPED : RenderBatchItemStatus.FAILED,
              errorCode: "VALIDATION_FAILED",
              errorMessage: recordValidation.errors.join("; "),
              warningJson: recordValidation.warnings as Prisma.InputJsonValue
            }
          })
        );
        continue;
      }

      const previewJson = this.templateRenderService.buildPreviewPayload(
        template.mappingJson as Record<string, unknown>,
        student,
        template.school,
        template.lastSnapshotVersion || 1,
        {
          side: "both",
          layout: {
            front: template.frontLayoutJson || null,
            back: template.backLayoutJson || null
          }
        }
      ) as Prisma.InputJsonValue;

      successCount += 1;
      itemOps.push(
        this.prisma.renderBatchItem.create({
          data: {
            batchId: batch.id,
            studentId: student.id,
            status: RenderBatchItemStatus.SUCCESS,
            warningJson: recordValidation.warnings as Prisma.InputJsonValue,
            previewJson
          }
        })
      );
    }

    if (itemOps.length) {
      await this.prisma.$transaction(itemOps);
    }

    const completedStatus =
      successCount > 0 && failedCount > 0
        ? RenderBatchStatus.PARTIAL_FAILED
        : successCount > 0
          ? RenderBatchStatus.COMPLETED
          : RenderBatchStatus.FAILED;

    await this.prisma.renderBatch.update({
      where: { id: batch.id },
      data: {
        status: completedStatus,
        successCount,
        failedCount,
        finishedAt: new Date()
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "RENDER_BATCH",
        entityId: batch.id,
        action: "CREATE",
        newValue: {
          templateId: template.id,
          totalRecords: students.length,
          successCount,
          failedCount
        } as Prisma.InputJsonValue
      }
    });

    const payload = await this.getRenderBatch(actor, batch.id);
    if (dto.outputFormat) {
      const exportResult = await this.exportRenderBatch(actor, batch.id, {
        format: dto.outputFormat,
        pageSize: dto.pageSize,
        customPageMm: dto.customPageMm,
        grid: dto.grid,
        sideMode: dto.sideMode
      });
      return { batch: payload, export: exportResult };
    }
    return payload;
  }

  async listRenderBatches(actor: AuthenticatedUser, schoolId: string) {
    await this.assertSchoolAccess(actor, schoolId);
    return this.prisma.renderBatch.findMany({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        template: {
          select: {
            id: true,
            templateCode: true,
            name: true,
            status: true
          }
        },
        initiatedBy: {
          select: {
            id: true,
            email: true,
            role: true
          }
        },
        _count: { select: { items: true } }
      }
    });
  }

  async getRenderBatch(actor: AuthenticatedUser, batchId: string, options?: { includeSensitive?: boolean }) {
    const batch = await this.prisma.renderBatch.findUnique({
      where: { id: batchId },
      include: {
        school: { select: { id: true, name: true, code: true } },
        template: {
          select: {
            id: true,
            templateCode: true,
            name: true,
            cardType: true,
            orientation: true,
            cardWidthMm: true,
            cardHeightMm: true,
            frontLayoutJson: true,
            backLayoutJson: true,
            mappingJson: true
          }
        },
        initiatedBy: { select: { id: true, email: true, role: true } },
        items: {
          orderBy: { createdAt: "asc" },
          include: {
            student: {
              select: {
                id: true,
                fullName: true,
                className: true,
                section: true,
                rollNumber: true,
                parentName: true,
                parentNameCiphertext: true,
                parentMobile: true,
                parentMobileCiphertext: true,
                address: true,
                addressCiphertext: true,
                photoKey: true
              }
            }
          }
        }
      }
    });
    if (!batch) throw new NotFoundException("Render batch not found");
    await this.assertSchoolAccess(actor, batch.schoolId);
    const normalizedItems = batch.items.map((item) => ({
      ...item,
      student: this.stripStudentSensitiveCiphertext(this.hydrateStudentSensitiveFields(item.student))
    }));
    if (options?.includeSensitive) {
      return {
        ...batch,
        items: normalizedItems
      };
    }
    return {
      ...batch,
      items: normalizedItems.map((item) => ({
        ...item,
        student: this.maskStudentSummary(actor, item.student),
        previewJson: this.canViewSensitiveStudentData(actor)
          ? item.previewJson
          : this.sanitizeAuditPayload(item.previewJson)
      }))
    };
  }

  async exportRenderBatch(actor: AuthenticatedUser, batchId: string, dto: ExportRenderBatchDto) {
    this.assertCanExportRenderBatch(actor);
    const batch = await this.getRenderBatch(actor, batchId, { includeSensitive: true });
    const format = dto.format || "PDF";
    const successful = batch.items.filter((item) => item.status === RenderBatchItemStatus.SUCCESS);
    if (!successful.length) {
      throw new BadRequestException("No successful items available to export");
    }

    const sideMode = dto.sideMode || "FRONT_BACK";
    const pageSize = dto.pageSize || "A4";
    const grid = dto.grid || "3x8";
    const customPageMm = dto.customPageMm;

    let artifactBuffer: Buffer;
    if (format === "PDF") {
      artifactBuffer = await this.buildRenderBatchPdf({
        batchId: batch.id,
        schoolName: batch.school.name,
        templateName: batch.template.name,
        templateCode: batch.template.templateCode || batch.template.id,
        sideMode,
        pageSize,
        customPageMm,
        grid,
        items: successful
      });
    } else {
      const json = {
        batchId: batch.id,
        generatedAt: new Date().toISOString(),
        sideMode,
        pageSize,
        grid,
        rows: successful.map((row) => ({
          studentId: row.student.id,
          fullName: row.student.fullName,
          className: row.student.className,
          section: row.student.section,
          rollNumber: row.student.rollNumber,
          previewJson: row.previewJson
        }))
      };
      artifactBuffer = Buffer.from(JSON.stringify(json, null, 2), "utf8");
    }

    const persisted = await this.persistGeneratedArtifact(
      "render-batches",
      batch.id,
      format.toLowerCase(),
      artifactBuffer
    );
    const artifactUrl = `generated://render-batches/${persisted.fileName}`;

    await this.prisma.renderBatch.update({
      where: { id: batch.id },
      data: {
        artifactUrl,
        artifactMetaJson: {
          format,
          sideMode,
          pageSize,
          grid,
          byteSize: artifactBuffer.byteLength,
          localPath: persisted.localPath,
          generatedAt: new Date().toISOString(),
          records: successful.length
        } as Prisma.InputJsonValue
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "RENDER_BATCH",
        entityId: batch.id,
        action: "EXPORT",
        newValue: {
          format,
          sideMode,
          pageSize,
          grid,
          records: successful.length
        } as Prisma.InputJsonValue
      }
    });

    return {
      batchId: batch.id,
      format,
      artifactUrl,
      fileName: persisted.fileName,
      byteSize: artifactBuffer.byteLength,
      records: successful.length
    };
  }

  listTemplateTokens() {
    return this.templateRenderService.getTokenCatalog();
  }

  async listTemplateSnapshots(actor: AuthenticatedUser, templateId: string) {
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
      select: { id: true, schoolId: true, name: true }
    });
    if (!template) throw new NotFoundException("Template not found");
    await this.assertSchoolAccess(actor, template.schoolId);

    const snapshots = await this.prisma.templateSnapshot.findMany({
      where: { templateId },
      orderBy: { version: "desc" },
      select: {
        id: true,
        version: true,
        status: true,
        frontDesignUrl: true,
        backDesignUrl: true,
        notes: true,
        schemaVersion: true,
        createdAt: true,
        createdBy: { select: { id: true, email: true, role: true } }
      }
    });

    return {
      template,
      snapshots
    };
  }

  private async applyApprovalWorkflowAction(
    actor: AuthenticatedUser,
    workflowId: string,
    dto: ApprovalWorkflowActionDto
  ) {
    const workflow = await this.prisma.approvalWorkflow.findUnique({
      where: { id: workflowId },
      include: {
        chain: {
          select: {
            id: true,
            name: true,
            institutionType: true,
            steps: {
              orderBy: { stepOrder: "asc" },
              select: { id: true, stepOrder: true, role: true, label: true, isOptional: true }
            }
          }
        },
        currentStep: {
          select: { id: true, stepOrder: true, role: true, label: true, isOptional: true }
        },
        student: {
          select: {
            id: true,
            schoolId: true,
            status: true,
            intakeStage: true
          }
        }
      }
    });
    if (!workflow) throw new NotFoundException("Approval workflow not found");
    this.resolveScopedSchoolIds(actor, workflow.schoolId);

    const comment = dto.comment?.trim();
    const fromStatus = workflow.status;
    const action = dto.action;
    const now = new Date();

    if (
      workflow.status === ApprovalWorkflowStatus.APPROVED ||
      workflow.status === ApprovalWorkflowStatus.REJECTED
    ) {
      if (action !== ApprovalActionType.COMMENT) {
        throw new BadRequestException("Workflow is already closed");
      }
    }

    if (action !== ApprovalActionType.COMMENT) {
      if (!workflow.currentStep) {
        throw new BadRequestException("Workflow has no active step");
      }
      this.assertCanActOnApprovalStep(actor, workflow.currentStep.role);
    }

    let toStatus = workflow.status;
    let nextStepId = workflow.currentStepId;
    let studentPatch: Prisma.StudentUpdateInput | null = null;
    let approvalRequestPatch:
      | {
          status: ApprovalRequestStatus;
          approvedByUserId: string;
          decidedAt: Date;
        }
      | null = null;

    if (action === ApprovalActionType.REJECT) {
      toStatus = ApprovalWorkflowStatus.REJECTED;
      nextStepId = null;
      studentPatch = {
        status: StudentStatus.REJECTED,
        intakeStage: IntakeSubmissionStage.REJECTED,
        rejectionNote: comment || "Rejected during approval workflow"
      };
      approvalRequestPatch = {
        status: ApprovalRequestStatus.REJECTED,
        approvedByUserId: actor.sub,
        decidedAt: now
      };
    } else if (action === ApprovalActionType.SEND_BACK) {
      toStatus = ApprovalWorkflowStatus.SENT_BACK;
      nextStepId = workflow.chain.steps[0]?.id ?? workflow.currentStepId;
      studentPatch = {
        status: StudentStatus.SUBMITTED,
        intakeStage: IntakeSubmissionStage.SALES_CORRECTED,
        rejectionNote: comment || "Sent back for correction"
      };
    } else if (action === ApprovalActionType.APPROVE) {
      const currentOrder = workflow.currentStep?.stepOrder ?? 0;
      const nextStep = workflow.chain.steps.find((step) => step.stepOrder > currentOrder);

      if (nextStep) {
        toStatus = ApprovalWorkflowStatus.IN_PROGRESS;
        nextStepId = nextStep.id;
        studentPatch = {
          intakeStage: IntakeSubmissionStage.AWAITING_INSTITUTION_APPROVAL
        };
      } else {
        toStatus = ApprovalWorkflowStatus.APPROVED;
        nextStepId = null;
        studentPatch = {
          status: StudentStatus.SCHOOL_APPROVED,
          intakeStage: IntakeSubmissionStage.APPROVED_FOR_DESIGN,
          rejectionNote: null
        };
        approvalRequestPatch = {
          status: ApprovalRequestStatus.APPROVED,
          approvedByUserId: actor.sub,
          decidedAt: now
        };
      }
    } else if (action === ApprovalActionType.COMMENT) {
      toStatus = workflow.status;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedWorkflow = await tx.approvalWorkflow.update({
        where: { id: workflow.id },
        data: {
          status: toStatus,
          currentStepId: nextStepId,
          latestComment: comment || workflow.latestComment || null,
          decidedById:
            toStatus === ApprovalWorkflowStatus.APPROVED || toStatus === ApprovalWorkflowStatus.REJECTED
              ? action === ApprovalActionType.COMMENT
                ? workflow.decidedById
                : actor.sub
              : null,
          decidedAt:
            toStatus === ApprovalWorkflowStatus.APPROVED || toStatus === ApprovalWorkflowStatus.REJECTED
              ? action === ApprovalActionType.COMMENT
                ? workflow.decidedAt
                : now
              : null
        },
        include: {
          currentStep: { select: { id: true, stepOrder: true, role: true, label: true } }
        }
      });

      await tx.approvalWorkflowAction.create({
        data: {
          workflowId: workflow.id,
          stepId: workflow.currentStepId,
          actorUserId: actor.sub,
          action,
          comment: comment || null,
          fromStatus,
          toStatus
        }
      });

      if (studentPatch) {
        await tx.student.update({
          where: { id: workflow.studentId },
          data: studentPatch
        });
      }

      if (approvalRequestPatch) {
        await tx.approvalRequest.updateMany({
          where: {
            approvalWorkflowId: workflow.id,
            status: ApprovalRequestStatus.PENDING
          },
          data: approvalRequestPatch
        });
      }

      return updatedWorkflow;
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "APPROVAL_WORKFLOW",
        entityId: workflow.id,
        action: `ACTION_${action}`,
        newValue: {
          fromStatus,
          toStatus,
          currentStepId: workflow.currentStepId,
          nextStepId,
          comment: comment || null
        } as Prisma.InputJsonValue
      }
    });

    return updated;
  }

  private normalizeApprovalChainSteps(steps: CreateApprovalChainStepInput[]) {
    return steps.map((step) => {
      const normalized = normalizeRole(step.role);
      if (!normalized) {
        throw new BadRequestException(`Invalid approval role: ${step.role}`);
      }
      if (!APPROVAL_STEP_ROLE_SET.has(normalized)) {
        throw new BadRequestException(`Unsupported approval step role: ${normalized}`);
      }
      return {
        role: normalized as PrismaRole,
        label: step.label?.trim(),
        isOptional: step.isOptional ?? false,
        slaHours: step.slaHours
      };
    });
  }

  private canViewSensitiveStudentData(actor: AuthenticatedUser) {
    const role = normalizeRole(actor.normalizedRole);
    return (
      role === Role.SUPER_ADMIN ||
      role === Role.COMPANY_ADMIN ||
      role === Role.OPERATIONS_ADMIN ||
      role === Role.SCHOOL_ADMIN ||
      role === Role.SCHOOL_STAFF
    );
  }

  private maskSchoolContacts<
    T extends {
      email?: string | null;
      phone?: string | null;
      address?: string | null;
      principalName?: string | null;
      principalEmail?: string | null;
      principalPhone?: string | null;
    }
  >(actor: AuthenticatedUser, row: T): T {
    const role = normalizeRole(actor.normalizedRole);
    if (role !== Role.PRINTING && role !== Role.PRINT_OPS) {
      return row;
    }

    return {
      ...row,
      email: row.email ? this.dataProtectionService.maskEmail(row.email) : row.email,
      phone: row.phone ? this.dataProtectionService.maskPhone(row.phone) : row.phone,
      address: row.address ? this.dataProtectionService.maskAddress(row.address) : row.address,
      principalName: row.principalName ? this.dataProtectionService.maskName(row.principalName) : row.principalName,
      principalEmail: row.principalEmail
        ? this.dataProtectionService.maskEmail(row.principalEmail)
        : row.principalEmail,
      principalPhone: row.principalPhone
        ? this.dataProtectionService.maskPhone(row.principalPhone)
        : row.principalPhone
    } as T;
  }

  private applyStudentSensitiveProtection(
    data: Prisma.StudentCreateInput | Prisma.StudentUpdateInput,
    fields: {
      parentName?: string | null;
      parentMobile?: string | null;
      address?: string | null;
    }
  ) {
    if (fields.parentName !== undefined) {
      const value = fields.parentName?.trim() || null;
      Object.assign(data, {
        parentName: value ? this.dataProtectionService.maskName(value) || value : "",
        parentNameCiphertext: this.dataProtectionService.encryptText(value)
      });
    }

    if (fields.parentMobile !== undefined) {
      const value = fields.parentMobile?.trim() || null;
      Object.assign(data, {
        parentMobile: value ? this.dataProtectionService.maskPhone(value) || value : "",
        parentMobileCiphertext: this.dataProtectionService.encryptText(value)
      });
    }

    if (fields.address !== undefined) {
      const value = fields.address?.trim() || null;
      Object.assign(data, {
        address: value ? this.dataProtectionService.maskAddress(value) || value : "",
        addressCiphertext: this.dataProtectionService.encryptText(value)
      });
    }

    return data;
  }

  private hydrateStudentSensitiveFields<
    T extends {
      parentName?: string | null;
      parentMobile?: string | null;
      address?: string | null;
      parentNameCiphertext?: string | null;
      parentMobileCiphertext?: string | null;
      addressCiphertext?: string | null;
    }
  >(row: T): T {
    return {
      ...row,
      parentName: this.dataProtectionService.decryptText(row.parentNameCiphertext, row.parentName),
      parentMobile: this.dataProtectionService.decryptText(row.parentMobileCiphertext, row.parentMobile),
      address: this.dataProtectionService.decryptText(row.addressCiphertext, row.address)
    } as T;
  }

  private stripStudentSensitiveCiphertext<
    T extends {
      parentNameCiphertext?: string | null;
      parentMobileCiphertext?: string | null;
      addressCiphertext?: string | null;
    }
  >(row: T) {
    const {
      parentNameCiphertext: _parentNameCiphertext,
      parentMobileCiphertext: _parentMobileCiphertext,
      addressCiphertext: _addressCiphertext,
      ...rest
    } = row;
    return rest as Omit<T, "parentNameCiphertext" | "parentMobileCiphertext" | "addressCiphertext">;
  }

  private maskStudentSummary<
    T extends {
      parentName?: string | null;
      parentMobile?: string | null;
      address?: string | null;
      parentNameCiphertext?: string | null;
      parentMobileCiphertext?: string | null;
      addressCiphertext?: string | null;
    }
  >(actor: AuthenticatedUser, row: T): T {
    const hydrated = this.hydrateStudentSensitiveFields(row);

    if (this.canViewSensitiveStudentData(actor)) {
      return this.stripStudentSensitiveCiphertext(hydrated) as T;
    }

    const role = normalizeRole(actor.normalizedRole);
    return this.stripStudentSensitiveCiphertext({
      ...hydrated,
      parentName:
        role === Role.PRINTING || role === Role.PRINT_OPS
          ? hydrated.parentName
            ? this.dataProtectionService.maskName(hydrated.parentName)
            : hydrated.parentName
          : hydrated.parentName,
      parentMobile: hydrated.parentMobile ? this.dataProtectionService.maskPhone(hydrated.parentMobile) : hydrated.parentMobile,
      address: hydrated.address ? this.dataProtectionService.maskAddress(hydrated.address) : hydrated.address
    } as T) as T;
  }

  private maskReviewQueueRow<
    T extends {
      parentName?: string | null;
      parentMobile?: string | null;
      address?: string | null;
      parentNameCiphertext?: string | null;
      parentMobileCiphertext?: string | null;
      addressCiphertext?: string | null;
      parent?: { id: string; mobile?: string | null; mobileCiphertext?: string | null } | null;
    }
  >(actor: AuthenticatedUser, row: T): T {
    const parentMobile = row.parent
      ? this.dataProtectionService.decryptText(row.parent.mobileCiphertext, row.parent.mobile)
      : null;
    const sanitizedParent = row.parent
      ? (() => {
          const { mobileCiphertext: _mobileCiphertext, ...restParent } = row.parent;
          return {
            ...restParent,
            mobile: this.canViewSensitiveStudentData(actor)
              ? parentMobile
              : this.dataProtectionService.maskPhone(parentMobile)
          };
        })()
      : row.parent;
    return {
      ...this.maskStudentSummary(actor, row),
      parent: sanitizedParent
    } as T;
  }

  private sanitizeAuditPayload<T>(value: T): T {
    return value == null ? value : this.dataProtectionService.redactForLogs(value);
  }

  private sanitizeAuditLogRow<T extends { oldValue?: unknown; newValue?: unknown }>(row: T): T {
    return {
      ...row,
      oldValue: this.sanitizeAuditPayload(row.oldValue),
      newValue: this.sanitizeAuditPayload(row.newValue)
    } as T;
  }

  private sanitizeCorrectionLogRow<T extends { beforeJson?: unknown; afterJson?: unknown }>(row: T): T {
    return {
      ...row,
      beforeJson: this.sanitizeAuditPayload(row.beforeJson),
      afterJson: this.sanitizeAuditPayload(row.afterJson)
    } as T;
  }

  private assertCanActOnApprovalStep(actor: AuthenticatedUser, stepRole: PrismaRole) {
    if (isSuperAdminRole(actor.normalizedRole) || isCompanyAdminRole(actor.normalizedRole)) return;

    const actorRole = normalizeRole(actor.normalizedRole);
    const requiredRole = normalizeRole(stepRole);

    if (actorRole !== requiredRole) {
      throw new ForbiddenException(`Current step requires ${requiredRole} role`);
    }
  }

  private resolveScopedSchoolIds(actor: AuthenticatedUser, requestedSchoolId?: string): string[] | undefined {
    if (requestedSchoolId) {
      if (isSuperAdminRole(actor.normalizedRole) || isCompanyAdminRole(actor.normalizedRole)) {
        return [requestedSchoolId];
      }

      if (isSalesRole(actor.normalizedRole)) {
        if (!actor.assignedSchoolIds.includes(requestedSchoolId)) {
          throw new ForbiddenException("Access denied for the requested school");
        }
        return [requestedSchoolId];
      }

      if (isSchoolRole(actor.normalizedRole)) {
        if (actor.schoolId !== requestedSchoolId) {
          throw new ForbiddenException("Access denied for the requested school");
        }
        return [requestedSchoolId];
      }

      if (!actor.assignedSchoolIds.includes(requestedSchoolId)) {
        throw new ForbiddenException("Access denied for the requested school");
      }
      return [requestedSchoolId];
    }

    if (isSuperAdminRole(actor.normalizedRole) || isCompanyAdminRole(actor.normalizedRole)) {
      return undefined;
    }

    if (isSchoolRole(actor.normalizedRole)) {
      if (!actor.schoolId) throw new ForbiddenException("School user scope missing");
      return [actor.schoolId];
    }

    if (actor.assignedSchoolIds.length > 0) {
      return [...new Set(actor.assignedSchoolIds)];
    }

    throw new ForbiddenException("No school scope assigned");
  }

  private generateBatchCode(prefix: "PB" | "RPB") {
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const suffix = randomBytes(2).toString("hex").toUpperCase();
    return `${prefix}-${y}${m}${d}-${suffix}`;
  }

  private async persistGeneratedArtifact(scope: string, id: string, ext: string, payload: Buffer) {
    const dir = join(process.cwd(), ".generated", scope);
    await mkdir(dir, { recursive: true });
    const fileName = `${id}-${Date.now()}.${ext}`;
    const localPath = join(dir, fileName);
    await writeFile(localPath, payload);
    return { fileName, localPath };
  }

  private resolvePageMm(pageSize: "A4" | "A3" | "CUSTOM", customPageMm?: string) {
    if (pageSize === "A3") return { widthMm: 297, heightMm: 420 };
    if (pageSize === "CUSTOM" && customPageMm?.trim()) {
      const match = customPageMm.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
      if (match) {
        const widthMm = Number(match[1]);
        const heightMm = Number(match[2]);
        if (Number.isFinite(widthMm) && Number.isFinite(heightMm) && widthMm >= 100 && heightMm >= 100) {
          return { widthMm, heightMm };
        }
      }
    }
    return { widthMm: 210, heightMm: 297 };
  }

  private resolveGrid(grid?: string) {
    const fallback = { cols: 3, rows: 8 };
    if (!grid?.trim()) return fallback;
    const match = grid.trim().toLowerCase().match(/^(\d{1,2})x(\d{1,2})$/);
    if (!match) return fallback;
    const cols = Number(match[1]);
    const rows = Number(match[2]);
    if (!Number.isFinite(cols) || !Number.isFinite(rows) || cols < 1 || cols > 10 || rows < 1 || rows > 20) {
      return fallback;
    }
    return { cols, rows };
  }

  private mmToPt(mm: number) {
    return (mm * 72) / 25.4;
  }

  private async buildRenderBatchPdf(input: {
    batchId: string;
    schoolName: string;
    templateName: string;
    templateCode: string;
    sideMode: "FRONT_ONLY" | "BACK_ONLY" | "FRONT_BACK";
    pageSize: "A4" | "A3" | "CUSTOM";
    customPageMm?: string;
    grid?: string;
    items: Array<{
      id: string;
      previewJson?: unknown;
      status: RenderBatchItemStatus;
      student: {
        id: string;
        fullName: string;
        className?: string | null;
        section?: string | null;
        rollNumber?: string | null;
        parentName?: string | null;
        parentMobile?: string | null;
        address?: string | null;
        photoKey?: string | null;
      };
    }>;
  }) {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const pageMm = this.resolvePageMm(input.pageSize, input.customPageMm);
    const { cols, rows } = this.resolveGrid(input.grid);
    const marginMm = 8;
    const gutterMm = 2;
    const usableW = pageMm.widthMm - marginMm * 2 - gutterMm * (cols - 1);
    const usableH = pageMm.heightMm - marginMm * 2 - gutterMm * (rows - 1);
    const cardWmm = usableW / cols;
    const cardHmm = usableH / rows;
    const cardsPerPage = cols * rows;

    const sides: Array<"FRONT" | "BACK"> =
      input.sideMode === "FRONT_ONLY" ? ["FRONT"] : input.sideMode === "BACK_ONLY" ? ["BACK"] : ["FRONT", "BACK"];

    for (const side of sides) {
      for (let offset = 0; offset < input.items.length; offset += cardsPerPage) {
        const page = pdf.addPage([this.mmToPt(pageMm.widthMm), this.mmToPt(pageMm.heightMm)]);
        const batchSlice = input.items.slice(offset, offset + cardsPerPage);
        const pageHeight = this.mmToPt(pageMm.heightMm);

        page.drawText(`${input.schoolName}  |  ${input.templateName} (${input.templateCode})  |  ${side}`, {
          x: this.mmToPt(marginMm),
          y: pageHeight - this.mmToPt(5),
          size: 8,
          font: bold,
          color: rgb(0.12, 0.2, 0.35)
        });
        page.drawText(`Batch: ${input.batchId} • Generated: ${new Date().toISOString()}`, {
          x: this.mmToPt(marginMm),
          y: pageHeight - this.mmToPt(8.5),
          size: 6.5,
          font,
          color: rgb(0.32, 0.37, 0.45)
        });

        batchSlice.forEach((item, idx) => {
          const col = idx % cols;
          const row = Math.floor(idx / cols);
          const xMm = marginMm + col * (cardWmm + gutterMm);
          const yMm = pageMm.heightMm - marginMm - (row + 1) * cardHmm - row * gutterMm;
          const x = this.mmToPt(xMm);
          const y = this.mmToPt(yMm);
          const w = this.mmToPt(cardWmm);
          const h = this.mmToPt(cardHmm);

          page.drawRectangle({
            x,
            y,
            width: w,
            height: h,
            borderWidth: 0.7,
            borderColor: rgb(0.2, 0.26, 0.34)
          });

          const tokenMap =
            typeof item.previewJson === "object" &&
            item.previewJson !== null &&
            "tokenMap" in (item.previewJson as Record<string, unknown>)
              ? (((item.previewJson as Record<string, unknown>).tokenMap || {}) as Record<string, string>)
              : {};

          const fullName = tokenMap.student_name || item.student.fullName || "N/A";
          const studentId = tokenMap.student_id || item.student.id || "N/A";
          const className = tokenMap.class || item.student.className || "--";
          const section = tokenMap.section || item.student.section || "--";
          const rollNumber = tokenMap.roll_number || item.student.rollNumber || "--";
          const parentName = tokenMap.parent_name || item.student.parentName || "--";
          const parentMobile = tokenMap.parent_mobile || item.student.parentMobile || "--";
          const address = tokenMap.address || item.student.address || "--";

          const pad = this.mmToPt(2.6);
          const line = this.mmToPt(2.7);

          if (side === "FRONT") {
            page.drawText(fullName, {
              x: x + pad,
              y: y + h - pad - this.mmToPt(1.2),
              size: 8.5,
              font: bold,
              color: rgb(0.1, 0.16, 0.28),
              maxWidth: w - pad * 2
            });
            page.drawText(`ID: ${studentId}`, {
              x: x + pad,
              y: y + h - pad - line * 2.3,
              size: 7,
              font,
              color: rgb(0.28, 0.33, 0.43)
            });
            page.drawText(`Class: ${className}   Section: ${section}`, {
              x: x + pad,
              y: y + h - pad - line * 3.6,
              size: 7,
              font,
              color: rgb(0.28, 0.33, 0.43)
            });
            page.drawText(`Roll: ${rollNumber}`, {
              x: x + pad,
              y: y + h - pad - line * 4.8,
              size: 7,
              font,
              color: rgb(0.28, 0.33, 0.43)
            });
            page.drawRectangle({
              x: x + w - this.mmToPt(18),
              y: y + h - this.mmToPt(26),
              width: this.mmToPt(15),
              height: this.mmToPt(20),
              borderWidth: 0.6,
              borderColor: rgb(0.58, 0.64, 0.72)
            });
            page.drawText("PHOTO", {
              x: x + w - this.mmToPt(15.5),
              y: y + h - this.mmToPt(16),
              size: 6.2,
              font,
              color: rgb(0.55, 0.6, 0.68)
            });
          } else {
            page.drawText(`Parent: ${parentName}`, {
              x: x + pad,
              y: y + h - pad - this.mmToPt(1.2),
              size: 7.2,
              font,
              color: rgb(0.24, 0.3, 0.39),
              maxWidth: w - pad * 2
            });
            page.drawText(`Contact: ${parentMobile}`, {
              x: x + pad,
              y: y + h - pad - line * 2.6,
              size: 7,
              font,
              color: rgb(0.24, 0.3, 0.39)
            });
            page.drawText(`Address: ${address}`.slice(0, 96), {
              x: x + pad,
              y: y + h - pad - line * 4.2,
              size: 6.6,
              font,
              color: rgb(0.3, 0.35, 0.43),
              maxWidth: w - pad * 2
            });
            page.drawText("Emergency: Contact school administration", {
              x: x + pad,
              y: y + this.mmToPt(4),
              size: 6.3,
              font,
              color: rgb(0.4, 0.45, 0.52),
              maxWidth: w - pad * 2
            });
          }
        });
      }
    }

    const bytes = await pdf.save();
    return Buffer.from(bytes);
  }

  private async assertSchoolAccess(actor: AuthenticatedUser, schoolId: string) {
    this.accessControlService.assertSchoolAccess(actor, schoolId);
  }

  private assertCanExportSchoolReport(actor: AuthenticatedUser) {
    const role = normalizeRole(actor.normalizedRole);
    if (
      role === Role.SUPER_ADMIN ||
      role === Role.COMPANY_ADMIN ||
      role === Role.OPERATIONS_ADMIN ||
      role === Role.SALES_PERSON ||
      role === Role.SCHOOL_ADMIN
    ) {
      return;
    }
    throw new ForbiddenException("Not allowed to export school reports");
  }

  private assertCanGeneratePrintArtifact(actor: AuthenticatedUser) {
    const role = normalizeRole(actor.normalizedRole);
    if (
      role === Role.SUPER_ADMIN ||
      role === Role.COMPANY_ADMIN ||
      role === Role.OPERATIONS_ADMIN ||
      role === Role.PRINTING ||
      role === Role.PRINT_OPS ||
      role === Role.SCHOOL_ADMIN
    ) {
      return;
    }
    throw new ForbiddenException("Not allowed to generate protected print artifacts");
  }

  private assertCanExportPrintJob(actor: AuthenticatedUser) {
    this.assertCanGeneratePrintArtifact(actor);
  }

  private assertCanExportRenderBatch(actor: AuthenticatedUser) {
    const role = normalizeRole(actor.normalizedRole);
    if (
      role === Role.SUPER_ADMIN ||
      role === Role.COMPANY_ADMIN ||
      role === Role.OPERATIONS_ADMIN ||
      role === Role.SALES_PERSON ||
      role === Role.PRINTING ||
      role === Role.PRINT_OPS ||
      role === Role.SCHOOL_ADMIN
    ) {
      return;
    }
    throw new ForbiddenException("Not allowed to export render batches");
  }

  private parseDateRange(dateFrom?: string, dateTo?: string) {
    if (!dateFrom && !dateTo) return null;
    const out: Prisma.DateTimeFilter = {};
    if (dateFrom) out.gte = new Date(dateFrom);
    if (dateTo) {
      const d = new Date(dateTo);
      d.setHours(23, 59, 59, 999);
      out.lte = d;
    }
    return out;
  }

  private csvCell(value: string) {
    const escaped = value.replace(/"/g, "\"\"");
    return `"${escaped}"`;
  }
}
