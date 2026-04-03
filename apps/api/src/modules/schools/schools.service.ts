import { ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AccessControlService } from "../../common/access/access-control.service";
import { AuthenticatedUser } from "../../common/auth/auth-user.type";
import { isSalesRole, isSchoolRole } from "../../common/auth/role.utils";
import { Role } from "../../common/enums/role.enum";
import { CreateSchoolDto } from "./dto/create-school.dto";
import { CreateIntakeLinkDto } from "./dto/create-intake-link.dto";
import { createHash, randomBytes } from "crypto";
import * as bcrypt from "bcrypt";
import { InstitutionType, IntakeAudience, Prisma, SchoolStatus } from "@prisma/client";

const PUBLIC_LINK_LOOKUP_WINDOW_MS = 10 * 60 * 1000;
const PUBLIC_LINK_LOOKUP_LIMIT = 30;
const PUBLIC_LINK_MISS_LIMIT = 10;
const PUBLIC_LINK_IP_LOOKUP_LIMIT = 60;

type PublicLookupContext = {
  ip?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class SchoolsService {
  private readonly logger = new Logger(SchoolsService.name);
  private readonly publicLookupMap = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControlService: AccessControlService
  ) {}

  async createSchool(dto: CreateSchoolDto, actor: AuthenticatedUser) {
    const salesOwnerId = isSalesRole(actor.normalizedRole) ? actor.sub : dto.salesOwnerId;
    const schoolCode = dto.code?.trim()
      ? dto.code.trim().toUpperCase()
      : await this.generateSchoolCode(dto.name);
    let school;
    try {
      school = await this.prisma.school.create({
        data: {
          name: dto.name.trim(),
          code: schoolCode,
          email: dto.email.trim().toLowerCase(),
          phone: dto.phone?.trim(),
          address: dto.address?.trim(),
          city: dto.city?.trim(),
          state: dto.state?.trim(),
          principalName: dto.principalName?.trim(),
          principalEmail: dto.principalEmail?.trim().toLowerCase(),
          principalPhone: dto.principalPhone?.trim(),
          status: dto.status === "INACTIVE" ? SchoolStatus.INACTIVE : SchoolStatus.ACTIVE,
          salesOwnerId: salesOwnerId || null,
          institutionType: dto.institutionType || InstitutionType.SCHOOL
        }
      });
    } catch (e) {
      const maybe = e as { code?: string };
      if (maybe?.code === "P2002") {
        throw new ConflictException("School code or email already exists");
      }
      throw e;
    }

    if (dto.adminEmail && dto.adminPassword) {
      await this.prisma.user.upsert({
        where: { email: dto.adminEmail.toLowerCase() },
        create: {
          email: dto.adminEmail.toLowerCase(),
          passwordHash: await bcrypt.hash(dto.adminPassword, 10),
          role: Role.SCHOOL_ADMIN,
          schoolId: school.id
        },
        update: {
          role: Role.SCHOOL_ADMIN,
          schoolId: school.id,
          passwordHash: await bcrypt.hash(dto.adminPassword, 10)
        }
      });
    }

    if (salesOwnerId) {
      await this.prisma.salesAssignment.upsert({
        where: {
          salesPersonId_schoolId: {
            salesPersonId: salesOwnerId,
            schoolId: school.id
          }
        },
        create: {
          salesPersonId: salesOwnerId,
          schoolId: school.id,
          createdById: actor.sub
        },
        update: {
          deletedAt: null
        }
      });
    }

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "SCHOOL",
        entityId: school.id,
        action: "CREATE"
      }
    });

    return {
      ...school,
      trackingId: school.code
    };
  }

  async listSchools(query?: string, user?: AuthenticatedUser) {
    const scopedWhere: any = query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { code: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } }
          ]
        }
      : {};
    scopedWhere.deletedAt = null;
    scopedWhere.status = { not: SchoolStatus.ARCHIVED };

    if (user && isSchoolRole(user.normalizedRole) && user.schoolId) {
      scopedWhere.id = user.schoolId;
    }
    if (user && isSalesRole(user.normalizedRole)) {
      scopedWhere.id = { in: user.assignedSchoolIds };
    }

    return this.prisma.school.findMany({
      where: scopedWhere,
      orderBy: { createdAt: "desc" },
      take: 200
    });
  }

  async createIntakeLink(schoolIdFromParam: string, dto: CreateIntakeLinkDto, user: AuthenticatedUser) {
    const schoolId = isSchoolRole(user.normalizedRole) ? user.schoolId : schoolIdFromParam;
    if (!schoolId) throw new ForbiddenException("School context missing");
    if (isSchoolRole(user.normalizedRole) && schoolIdFromParam && schoolIdFromParam !== user.schoolId) {
      throw new ForbiddenException("School admin cannot create link for another school");
    }
    this.accessControlService.assertSchoolAccess(user, schoolId);

    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundException("School not found");

    const link = await this.prisma.intakeLink.create({
      data: {
        schoolId,
        token: this.generatePublicIntakeToken(),
        campaignName: dto.campaignName?.trim() || `${school.name} ${new Date().getFullYear()} Intake`,
        institutionType: dto.institutionType || school.institutionType || InstitutionType.SCHOOL,
        audience: dto.audience || IntakeAudience.PARENT,
        className: (dto.className || "ALL").toUpperCase(),
        section: (dto.section || "ALL").toUpperCase(),
        maxStudentsPerParent: dto.maxStudentsPerParent ?? 3,
        photoBgPreference: (dto.photoBgPreference || "NONE").toUpperCase(),
        allowSiblings: dto.allowSiblings ?? true,
        allowDraftSave: dto.allowDraftSave ?? true,
        photoCaptureRequired: dto.photoCaptureRequired ?? true,
        allowPhotoUpload: dto.allowPhotoUpload ?? true,
        paymentRequired: dto.paymentRequired ?? false,
        approvalOwnerId: dto.approvalOwnerId || null,
        templateId: dto.templateId || null,
        formSchema: (dto.formSchema || undefined) as Prisma.InputJsonValue | undefined,
        metadataJson: (dto.metadataJson || undefined) as Prisma.InputJsonValue | undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.sub,
        entityType: "INTAKE_LINK",
        entityId: link.id,
        action: "CREATE",
        newValue: {
          schoolId: link.schoolId,
          tokenDigest: this.publicLinkAuditEntityId(link.token),
          campaignName: link.campaignName,
          institutionType: link.institutionType,
          audience: link.audience,
          className: link.className,
          section: link.section,
          paymentRequired: link.paymentRequired
        }
      }
    });
    return link;
  }

  async listIntakeLinks(user: AuthenticatedUser, schoolIdFromQuery?: string) {
    let schoolId = isSchoolRole(user.normalizedRole) ? user.schoolId : schoolIdFromQuery;
    if (schoolId) this.accessControlService.assertSchoolAccess(user, schoolId);
    if (!schoolId && isSalesRole(user.normalizedRole)) {
      const assignedSchoolIds = user.assignedSchoolIds.length ? user.assignedSchoolIds : ["__none__"];
      return this.prisma.intakeLink.findMany({
        where: { schoolId: { in: assignedSchoolIds }, deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: {
          school: { select: { id: true, name: true, code: true } },
          approvalOwner: { select: { id: true, email: true, role: true } },
          template: { select: { id: true, name: true, isActive: true } }
        }
      });
    }

    return this.prisma.intakeLink.findMany({
      where: schoolId ? { schoolId, deletedAt: null } : { deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        school: { select: { id: true, name: true, code: true } },
        approvalOwner: { select: { id: true, email: true, role: true } },
        template: { select: { id: true, name: true, isActive: true } }
      }
    });
  }

  async getIntakeLinkByToken(token: string, context: PublicLookupContext = {}) {
    const normalizedToken = token.trim();
    if (!normalizedToken) {
      await this.auditPublicLookup("PUBLIC_LINK_RESOLUTION_FAILED", "__empty__", context, {
        reason: "EMPTY_TOKEN"
      });
      throw new NotFoundException("Link not found");
    }

    await this.assertPublicLookupRateLimit(normalizedToken, context);

    const link = await this.prisma.intakeLink.findUnique({
      where: { token: normalizedToken },
      include: {
        school: { select: { name: true, code: true } }
      }
    });
    if (!link || link.deletedAt || !link.isActive || link.expiresAt < new Date()) {
      this.recordPublicLookupMiss(normalizedToken, context);
      await this.auditPublicLookup("PUBLIC_LINK_RESOLUTION_FAILED", normalizedToken, context, {
        reason: "NOT_FOUND_OR_INACTIVE"
      });
      throw new NotFoundException("Link not found");
    }

    this.recordPublicLookupSuccess(normalizedToken, context);
    await this.auditPublicLookup("PUBLIC_LINK_RESOLVED", normalizedToken, context, {
      institutionType: link.institutionType,
      audience: link.audience,
      schoolCode: link.school.code,
      expiresAt: link.expiresAt.toISOString()
    });
    return this.buildPublicIntakeLinkResponse(link);
  }

  private async generateSchoolCode(name: string) {
    const cleaned = name
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, " ")
      .trim();
    const initials = cleaned
      .split(/\s+/)
      .filter(Boolean)
      .map((chunk) => chunk[0])
      .join("")
      .slice(0, 4);
    const prefix = (initials || "SCH").padEnd(3, "X");

    for (let i = 1; i <= 200; i += 1) {
      const candidate = `${prefix}${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
      const exists = await this.prisma.school.findUnique({
        where: { code: candidate },
        select: { id: true }
      });
      if (!exists) return candidate;
    }
    throw new ConflictException("Unable to allocate school code. Try again.");
  }

  private generatePublicIntakeToken() {
    return `lnk_${randomBytes(20).toString("hex")}`;
  }

  private buildPublicIntakeLinkResponse(
    link: {
      token: string;
      campaignName: string;
      institutionType: InstitutionType;
      audience: IntakeAudience;
      className: string;
      section: string;
      maxStudentsPerParent: number;
      photoBgPreference: string;
      allowSiblings: boolean;
      allowDraftSave: boolean;
      photoCaptureRequired: boolean;
      allowPhotoUpload: boolean;
      paymentRequired: boolean;
      expiresAt: Date;
      school: { name: string; code: string };
    }
  ) {
    return {
      token: link.token,
      campaignName: link.campaignName,
      institutionType: link.institutionType,
      audience: link.audience,
      className: link.className,
      section: link.section,
      maxStudentsPerParent: link.maxStudentsPerParent,
      photoBgPreference: link.photoBgPreference,
      allowSiblings: link.allowSiblings,
      allowDraftSave: link.allowDraftSave,
      photoCaptureRequired: link.photoCaptureRequired,
      allowPhotoUpload: link.allowPhotoUpload,
      paymentRequired: link.paymentRequired,
      expiresAt: link.expiresAt,
      school: link.school
    };
  }

  private async assertPublicLookupRateLimit(token: string, context: PublicLookupContext) {
    const tokenDigest = this.hash(token);
    const ipDigest = this.hash(this.resolvePublicLookupIp(context));
    const tokenKey = `public-link:token:${tokenDigest}`;
    const ipKey = `public-link:ip:${ipDigest}`;
    const missesKey = this.publicLookupMissKey(token, context);
    const now = Date.now();
    const recentTokenLookups = (this.publicLookupMap.get(tokenKey) ?? []).filter(
      (ts) => now - ts < PUBLIC_LINK_LOOKUP_WINDOW_MS
    );
    recentTokenLookups.push(now);
    this.publicLookupMap.set(tokenKey, recentTokenLookups);

    const recentIpLookups = (this.publicLookupMap.get(ipKey) ?? []).filter(
      (ts) => now - ts < PUBLIC_LINK_LOOKUP_WINDOW_MS
    );
    recentIpLookups.push(now);
    this.publicLookupMap.set(ipKey, recentIpLookups);

    const recentMisses = (this.publicLookupMap.get(missesKey) ?? []).filter(
      (ts) => now - ts < PUBLIC_LINK_LOOKUP_WINDOW_MS
    );
    this.publicLookupMap.set(missesKey, recentMisses);

    if (
      recentTokenLookups.length > PUBLIC_LINK_LOOKUP_LIMIT ||
      recentIpLookups.length > PUBLIC_LINK_IP_LOOKUP_LIMIT ||
      recentMisses.length >= PUBLIC_LINK_MISS_LIMIT
    ) {
      this.logger.warn(
        `Public intake lookup throttled for token digest ${tokenDigest.slice(0, 12)} from ip digest ${ipDigest.slice(0, 12)}`
      );
      await this.auditPublicLookup("PUBLIC_LINK_RATE_LIMITED", token, context, {
        reason:
          recentMisses.length >= PUBLIC_LINK_MISS_LIMIT
            ? "MISS_LIMIT"
            : recentIpLookups.length > PUBLIC_LINK_IP_LOOKUP_LIMIT
              ? "IP_LOOKUP_LIMIT"
              : "TOKEN_LOOKUP_LIMIT"
      });
      throw new HttpException("Too many link lookup attempts. Please wait and try again.", HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private recordPublicLookupMiss(token: string, context: PublicLookupContext) {
    const key = this.publicLookupMissKey(token, context);
    const now = Date.now();
    const recent = (this.publicLookupMap.get(key) ?? []).filter((ts) => now - ts < PUBLIC_LINK_LOOKUP_WINDOW_MS);
    recent.push(now);
    this.publicLookupMap.set(key, recent);
  }

  private recordPublicLookupSuccess(token: string, context: PublicLookupContext) {
    this.publicLookupMap.delete(this.publicLookupMissKey(token, context));
  }

  private async auditPublicLookup(
    action: string,
    token: string,
    context: PublicLookupContext,
    meta?: Record<string, unknown>
  ) {
    await this.prisma.auditLog.create({
      data: {
        entityType: "INTAKE_LINK_PUBLIC",
        entityId: this.publicLinkAuditEntityId(token),
        action,
        ipAddress: this.resolvePublicLookupIp(context) || null,
        userAgent: this.resolvePublicLookupUserAgent(context),
        newValue: meta ? (meta as Prisma.InputJsonValue) : undefined
      }
    });
  }

  private resolvePublicLookupIp(context: PublicLookupContext) {
    return context.ip?.trim() || "unknown";
  }

  private resolvePublicLookupUserAgent(context: PublicLookupContext) {
    return context.userAgent?.trim().slice(0, 255) || null;
  }

  private publicLinkAuditEntityId(token: string) {
    return `LINK:${this.hash(token).slice(0, 32)}`;
  }

  private hash(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }

  private publicLookupMissKey(token: string, context: PublicLookupContext) {
    return `public-link:ip:${this.hash(this.resolvePublicLookupIp(context))}:token:${this.hash(token)}:miss`;
  }
}
