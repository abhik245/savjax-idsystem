import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AccessControlService } from "../../common/access/access-control.service";
import { AuthenticatedUser } from "../../common/auth/auth-user.type";
import { isSalesRole, isSchoolRole } from "../../common/auth/role.utils";
import { Role } from "../../common/enums/role.enum";
import { CreateSchoolDto } from "./dto/create-school.dto";
import { CreateIntakeLinkDto } from "./dto/create-intake-link.dto";
import { CreateIntakeCampaignDto } from "./dto/create-intake-campaign.dto";
import { createHash, randomBytes } from "crypto";
import * as bcrypt from "bcrypt";
import { InstitutionType, IntakeAudience, Prisma, SchoolStatus, StudentStatus } from "@prisma/client";

const PUBLIC_LINK_LOOKUP_WINDOW_MS = 10 * 60 * 1000;
const PUBLIC_LINK_LOOKUP_LIMIT = 30;
const PUBLIC_LINK_MISS_LIMIT = 10;
const PUBLIC_LINK_IP_LOOKUP_LIMIT = 60;
const SCHOOL_CODE_PREFIX = "SA";
const SCHOOL_CODE_PADDING = 4;
const SCHOOL_CODE_ALLOCATOR_ATTEMPTS = 12;

type PublicLookupContext = {
  ip?: string | null;
  userAgent?: string | null;
};

type NormalizedInstitutionRegistration = {
  identity: {
    institutionName: string;
    institutionType: InstitutionType;
    boardAffiliation: string;
    affiliationNumber: string;
    yearEstablished: number | null;
    location: {
      street: string;
      area: string;
      city: string;
      state: string;
      pinCode: string;
      latitude: number | null;
      longitude: number | null;
      campusType: "SINGLE" | "MULTI_CAMPUS";
    };
  };
  authority: {
    primaryDecisionMaker: {
      title: string | null;
      name: string;
      email: string;
      phone: string;
    };
    operationalContact: {
      title: string | null;
      name: string;
      phone: string;
      whatsapp: string;
      email: string;
    };
    procurementContact: {
      name: string | null;
      email: string | null;
      phone: string | null;
    };
    escalation: {
      secondaryContact: {
        name: string | null;
        email: string | null;
        phone: string | null;
      };
      approvalAuthorityFlag: boolean;
    };
  };
  configuration: {
    idCard: {
      cardTypes: {
        studentId: boolean;
        staffId: boolean;
        visitorId: boolean;
        smartCards: boolean;
      };
      dataFields: {
        name: boolean;
        photo: boolean;
        standard: boolean;
        className: boolean;
        division: boolean;
        department: boolean;
        idNumber: boolean;
        dob: boolean;
        bloodGroup: boolean;
        address: boolean;
        parentName: boolean;
        emergencyContact: boolean;
      };
      customFields: string[];
    };
    volumeScale: {
      totalStudents: number;
      totalStaff: number;
      expectedAnnualAdditions: number;
      classesOrDepartmentsStructure: string;
    };
    workflow: {
      approvalRequired: boolean;
      approvalLevels: "SINGLE" | "MULTI_LEVEL";
      autoApprovalThreshold: number | null;
    };
    delivery: {
      model: "CENTRALIZED" | "PER_CLASS";
      dispatchAddressConfirmation: boolean;
    };
  };
};

type NormalizedCampaignSegment = {
  segmentKey: string;
  label: string;
  primaryLabel: string;
  primaryValue: string;
  secondaryLabel: string | null;
  secondaryValue: string | null;
  expectedVolume: number;
  className: string;
  section: string;
};

type NormalizedCampaign = {
  name: string;
  institutionType: InstitutionType;
  audience: IntakeAudience;
  maxExpectedVolume: number;
  startsAt: Date;
  expiresAt: Date;
  targetSegments: NormalizedCampaignSegment[];
  dataSchema: Record<string, unknown>;
  submissionModel: Record<string, unknown>;
  approvalRules: Record<string, unknown>;
  metadata: Record<string, unknown>;
  linkConfig: {
    maxStudentsPerParent: number;
    photoBgPreference: string;
    allowSiblings: boolean;
    allowDraftSave: boolean;
    photoCaptureRequired: boolean;
    allowPhotoUpload: boolean;
    paymentRequired: boolean;
    approvalOwnerId: string | null;
    templateId: string | null;
  };
};

type LinkAggregateCounts = {
  submitted: number;
  approved: number;
  rejected: number;
  pending: number;
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
    const registrationData = this.normalizeRegistrationData(dto);
    const normalizedAddress = registrationData ? this.composeAddressFromRegistration(registrationData) : dto.address?.trim();
    const normalizedCity = registrationData?.identity.location.city || dto.city?.trim();
    const normalizedState = registrationData?.identity.location.state || dto.state?.trim();
    const normalizedPhone = dto.phone?.trim() || registrationData?.authority.operationalContact.phone;
    const normalizedPrincipalName = dto.principalName?.trim() || registrationData?.authority.primaryDecisionMaker.name;
    const normalizedPrincipalEmail =
      dto.principalEmail?.trim().toLowerCase() || registrationData?.authority.primaryDecisionMaker.email;
    const normalizedPrincipalPhone = dto.principalPhone?.trim() || registrationData?.authority.primaryDecisionMaker.phone;
    let school;
    for (let attempt = 1; attempt <= SCHOOL_CODE_ALLOCATOR_ATTEMPTS; attempt += 1) {
      try {
        school = await this.prisma.school.create({
          data: {
            name: dto.name.trim(),
            code: await this.generateSchoolCode(),
            email: dto.email.trim().toLowerCase(),
            phone: normalizedPhone || null,
            address: normalizedAddress || null,
            city: normalizedCity || null,
            state: normalizedState || null,
            principalName: normalizedPrincipalName || null,
            principalEmail: normalizedPrincipalEmail || null,
            principalPhone: normalizedPrincipalPhone || null,
            status: dto.status === "INACTIVE" ? SchoolStatus.INACTIVE : SchoolStatus.ACTIVE,
            salesOwnerId: salesOwnerId || null,
            institutionType: registrationData?.identity.institutionType || dto.institutionType || InstitutionType.SCHOOL,
            registrationDataJson: registrationData ? (registrationData as Prisma.InputJsonValue) : undefined
          }
        });
        break;
      } catch (e) {
        if (this.isSchoolCodeConflict(e) && attempt < SCHOOL_CODE_ALLOCATOR_ATTEMPTS) {
          continue;
        }
        if (this.isSchoolCodeConflict(e)) {
          throw new ConflictException("Unable to allocate a unique institution code. Please try again.");
        }
        throw e;
      }
    }

    if (!school) {
      throw new ConflictException("Unable to allocate a unique institution code. Please try again.");
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

  async createCampaign(schoolIdFromParam: string, dto: CreateIntakeCampaignDto, user: AuthenticatedUser) {
    const school = await this.resolveScopedSchool(schoolIdFromParam, user);
    const normalized = this.normalizeCampaignDto(dto, school);
    const created = await this.createCampaignWithLinks(school, normalized, user, "CREATE_CAMPAIGN");
    return this.serializeCampaign(created.campaign, created.links, new Map());
  }

  async createIntakeLink(schoolIdFromParam: string, dto: CreateIntakeLinkDto, user: AuthenticatedUser) {
    const school = await this.resolveScopedSchool(schoolIdFromParam, user);
    const normalized = this.normalizeLegacyLinkIntoCampaign(dto, school);
    const created = await this.createCampaignWithLinks(school, normalized, user, "CREATE_LEGACY_LINK");
    return created.links[0];
  }

  async listCampaigns(user: AuthenticatedUser, schoolIdFromQuery?: string) {
    let schoolId = isSchoolRole(user.normalizedRole) ? user.schoolId : schoolIdFromQuery;
    if (schoolId) this.accessControlService.assertSchoolAccess(user, schoolId);

    const where: Prisma.IntakeCampaignWhereInput = schoolId
      ? { schoolId, deletedAt: null }
      : isSalesRole(user.normalizedRole)
        ? { schoolId: { in: user.assignedSchoolIds.length ? user.assignedSchoolIds : ["__none__"] }, deletedAt: null }
        : { deletedAt: null };

    const campaigns = await this.prisma.intakeCampaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        school: { select: { id: true, name: true, code: true } },
        intakeLinks: {
          where: { deletedAt: null },
          orderBy: [{ className: "asc" }, { section: "asc" }, { createdAt: "asc" }],
          include: {
            approvalOwner: { select: { id: true, email: true, role: true } },
            template: { select: { id: true, name: true, isActive: true } }
          }
        }
      }
    });

    const campaignIds = campaigns.map((campaign) => campaign.id);
    const studentRows = campaignIds.length
      ? await this.prisma.student.findMany({
          where: {
            deletedAt: null,
            intakeLink: {
              campaignId: { in: campaignIds }
            }
          },
          select: {
            intakeLinkId: true,
            status: true
          }
        })
      : [];

    const linkStats = this.buildLinkStatsMap(studentRows);
    return campaigns.map((campaign) => this.serializeCampaign(campaign, campaign.intakeLinks, linkStats));
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
          campaign: { select: { id: true, name: true, expiresAt: true } },
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
        campaign: { select: { id: true, name: true, expiresAt: true } },
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
        school: { select: { name: true, code: true } },
        campaign: {
          select: {
            id: true,
            name: true,
            maxExpectedVolume: true,
            startsAt: true,
            expiresAt: true,
            targetSegmentsJson: true,
            dataSchemaJson: true,
            submissionModelJson: true,
            approvalRulesJson: true,
            metadataJson: true
          }
        }
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

  private async resolveScopedSchool(schoolIdFromParam: string, user: AuthenticatedUser) {
    const schoolId = isSchoolRole(user.normalizedRole) ? user.schoolId : schoolIdFromParam;
    if (!schoolId) throw new ForbiddenException("School context missing");
    if (isSchoolRole(user.normalizedRole) && schoolIdFromParam && schoolIdFromParam !== user.schoolId) {
      throw new ForbiddenException("School admin cannot create campaign for another school");
    }
    this.accessControlService.assertSchoolAccess(user, schoolId);

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        id: true,
        name: true,
        code: true,
        institutionType: true
      }
    });
    if (!school) throw new NotFoundException("School not found");
    return school;
  }

  private normalizeLegacyLinkIntoCampaign(
    dto: CreateIntakeLinkDto,
    school: { id: string; name: string; code: string; institutionType: InstitutionType }
  ) {
    return this.normalizeCampaignDto(
      {
        campaignName: dto.campaignName?.trim() || `${school.name} ${new Date().getFullYear()} Intake`,
        institutionType: dto.institutionType || school.institutionType || InstitutionType.SCHOOL,
        audience: dto.audience,
        targetSegments: [
          {
            primaryValue: dto.className || "ALL",
            secondaryValue: dto.section || "ALL",
            expectedVolume: dto.maxStudentsPerParent ?? 1
          }
        ],
        maxExpectedVolume: dto.maxStudentsPerParent ?? 1,
        expiresAt: dto.expiresAt,
        dataSchema: this.asRecord(dto.formSchema),
        submissionModel: {
          mode: dto.audience === IntakeAudience.PARENT ? "PARENT_DRIVEN" : "SELF_SERVICE",
          requirePhotoStandardization: true,
          workflowRequired: true
        },
        approvalRules: {
          approvalRequired: true
        },
        maxStudentsPerParent: dto.maxStudentsPerParent,
        photoBgPreference: dto.photoBgPreference,
        allowSiblings: dto.allowSiblings,
        allowDraftSave: dto.allowDraftSave,
        photoCaptureRequired: dto.photoCaptureRequired,
        allowPhotoUpload: dto.allowPhotoUpload,
        paymentRequired: dto.paymentRequired,
        approvalOwnerId: dto.approvalOwnerId,
        templateId: dto.templateId,
        metadataJson: {
          ...(this.asRecord(dto.metadataJson) as Record<string, unknown>),
          createdFrom: "LEGACY_INTAKE_LINK_ENDPOINT"
        }
      },
      school
    );
  }

  private normalizeCampaignDto(
    dto: CreateIntakeCampaignDto,
    school: { id: string; name: string; code: string; institutionType: InstitutionType }
  ): NormalizedCampaign {
    const institutionType = dto.institutionType || school.institutionType || InstitutionType.SCHOOL;
    const descriptor = this.getCampaignDescriptor(institutionType);
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : new Date();
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException("Campaign timeline is invalid");
    }
    if (expiresAt <= startsAt) {
      throw new BadRequestException("Campaign expiry must be after the start date");
    }

    const sourceSegments =
      dto.targetSegments && dto.targetSegments.length
        ? dto.targetSegments
        : [
            {
              primaryValue: "ALL",
              secondaryValue: "ALL",
              expectedVolume: dto.maxExpectedVolume ?? 0
            }
          ];

    const normalizedSegments = sourceSegments.reduce<NormalizedCampaignSegment[]>((acc, segment) => {
      const primaryValue = this.normalizeSegmentValue(segment.primaryValue, true);
      const secondaryValue = this.normalizeSegmentValue(segment.secondaryValue, true);
      if (!primaryValue) return acc;
      const normalizedPrimary = primaryValue.toUpperCase();
      const normalizedSecondary = (secondaryValue || "ALL").toUpperCase();
      acc.push({
        segmentKey: `${normalizedPrimary}__${normalizedSecondary}`,
        label: this.buildSegmentLabel(
          institutionType,
          descriptor.primaryLabel,
          primaryValue,
          descriptor.secondaryLabel,
          secondaryValue
        ),
        primaryLabel: descriptor.primaryLabel,
        primaryValue,
        secondaryLabel: descriptor.secondaryLabel,
        secondaryValue: secondaryValue || null,
        expectedVolume: Math.max(Number(segment.expectedVolume ?? 0), 0),
        className: normalizedPrimary,
        section: normalizedSecondary
      });
      return acc;
    }, []);

    if (!normalizedSegments.length) {
      throw new BadRequestException("At least one target segment is required");
    }

    const dedupe = new Set<string>();
    normalizedSegments.forEach((segment) => {
      if (dedupe.has(segment.segmentKey)) {
        throw new BadRequestException(`Duplicate target segment: ${segment.label}`);
      }
      dedupe.add(segment.segmentKey);
    });

    const expectedFromSegments = normalizedSegments.reduce((sum, segment) => sum + segment.expectedVolume, 0);
    const maxExpectedVolume = Math.max(dto.maxExpectedVolume ?? expectedFromSegments ?? 0, expectedFromSegments, 1);

    const schema = dto.dataSchema || {};
    const fullName = schema.fullName ?? schema.name ?? true;
    const className = schema.className ?? schema.classOrDepartment ?? true;
    const mobileNumber = schema.mobileNumber ?? schema.mobile ?? true;
    const fullAddress = schema.fullAddress ?? schema.address ?? false;
    const dataSchema = {
      fullName,
      name: fullName,
      photo: true,
      className,
      classOrDepartment: className,
      division: schema.division ?? false,
      rollNumber: schema.rollNumber ?? false,
      dob: schema.dob ?? false,
      bloodGroup: schema.bloodGroup ?? false,
      parentName: schema.parentName ?? institutionType === InstitutionType.SCHOOL,
      mobileNumber,
      mobile: mobileNumber,
      emergencyNumber: schema.emergencyNumber ?? false,
      fullAddress,
      address: fullAddress,
      aadhaarNumber: schema.aadhaarNumber ?? false,
      rfidRequired: schema.rfidRequired ?? false
    };

    const submissionDefaults = descriptor.submissionDefaults;
    const submissionModel = {
      mode: this.normalizeOptionalString(dto.submissionModel?.mode) || submissionDefaults.mode,
      actorType: dto.submissionModel?.actorType || submissionDefaults.actorType,
      requirePhotoStandardization:
        dto.submissionModel?.requirePhotoStandardization ?? submissionDefaults.requirePhotoStandardization,
      requireParentOtp: true,
      distributionChannels:
        dto.submissionModel?.distributionChannels?.map((channel) => channel.trim().toUpperCase()).filter(Boolean) ||
        submissionDefaults.distributionChannels,
      bulkUploadEnabled: dto.submissionModel?.bulkUploadEnabled ?? submissionDefaults.bulkUploadEnabled,
      intakeLinkOptional: dto.submissionModel?.intakeLinkOptional ?? submissionDefaults.intakeLinkOptional,
      workflowRequired: dto.submissionModel?.workflowRequired ?? true,
      allowMobileEditAfterVerification:
        dto.submissionModel?.allowMobileEditAfterVerification ?? submissionDefaults.allowMobileEditAfterVerification,
      duplicatePolicy: dto.submissionModel?.duplicatePolicy || submissionDefaults.duplicatePolicy
    };

    const approvalRules = {
      approvalRequired: dto.approvalRules?.approvalRequired ?? submissionModel.workflowRequired ?? true
    };

    const campaignName = this.normalizeString(dto.campaignName);
    if (!campaignName) {
      throw new BadRequestException("Campaign name is required");
    }

    return {
      name: campaignName,
      institutionType,
      audience: dto.audience || descriptor.defaultAudience,
      maxExpectedVolume,
      startsAt,
      expiresAt,
      targetSegments: normalizedSegments,
      dataSchema,
      submissionModel,
      approvalRules,
      metadata: {
        institutionLabel: descriptor.label,
        primaryLabel: descriptor.primaryLabel,
        secondaryLabel: descriptor.secondaryLabel,
        source: "INTAKE_CAMPAIGN",
        ...(this.asRecord(dto.metadataJson) as Record<string, unknown>)
      },
      linkConfig: {
        maxStudentsPerParent: dto.maxStudentsPerParent ?? 3,
        photoBgPreference: this.normalizeOptionalString(dto.photoBgPreference)?.toUpperCase() || "PLAIN",
        allowSiblings: dto.allowSiblings ?? true,
        allowDraftSave: dto.allowDraftSave ?? true,
        photoCaptureRequired: dto.photoCaptureRequired ?? true,
        allowPhotoUpload: dto.allowPhotoUpload ?? true,
        paymentRequired: dto.paymentRequired ?? false,
        approvalOwnerId: dto.approvalOwnerId || null,
        templateId: dto.templateId || null
      }
    };
  }

  private async createCampaignWithLinks(
    school: { id: string; name: string; code: string; institutionType: InstitutionType },
    normalized: NormalizedCampaign,
    user: AuthenticatedUser,
    action: string
  ) {
    return this.prisma.$transaction(async (tx) => {
      const campaign = await tx.intakeCampaign.create({
        data: {
          schoolId: school.id,
          name: normalized.name,
          institutionType: normalized.institutionType,
          audience: normalized.audience,
          maxExpectedVolume: normalized.maxExpectedVolume,
          startsAt: normalized.startsAt,
          expiresAt: normalized.expiresAt,
          targetSegmentsJson: normalized.targetSegments as unknown as Prisma.InputJsonValue,
          dataSchemaJson: normalized.dataSchema as Prisma.InputJsonValue,
          submissionModelJson: normalized.submissionModel as Prisma.InputJsonValue,
          approvalRulesJson: normalized.approvalRules as Prisma.InputJsonValue,
          metadataJson: normalized.metadata as Prisma.InputJsonValue
        }
      });

      const links = [];
      for (const segment of normalized.targetSegments) {
        const link = await tx.intakeLink.create({
          data: {
            schoolId: school.id,
            campaignId: campaign.id,
            token: this.generatePublicIntakeToken(),
            campaignName: normalized.name,
            institutionType: normalized.institutionType,
            audience: normalized.audience,
            className: segment.className,
            section: segment.section,
            maxStudentsPerParent: normalized.linkConfig.maxStudentsPerParent,
            photoBgPreference: normalized.linkConfig.photoBgPreference,
            allowSiblings: normalized.linkConfig.allowSiblings,
            allowDraftSave: normalized.linkConfig.allowDraftSave,
            photoCaptureRequired: normalized.linkConfig.photoCaptureRequired,
            allowPhotoUpload: normalized.linkConfig.allowPhotoUpload,
            paymentRequired: normalized.linkConfig.paymentRequired,
            approvalOwnerId: normalized.linkConfig.approvalOwnerId,
            templateId: normalized.linkConfig.templateId,
            formSchema: {
              dataSchema: normalized.dataSchema,
              submissionModel: normalized.submissionModel,
              approvalRules: normalized.approvalRules
            } as Prisma.InputJsonValue,
            metadataJson: {
              ...(normalized.metadata as Record<string, unknown>),
              segmentKey: segment.segmentKey,
              segmentLabel: segment.label,
              primaryLabel: segment.primaryLabel,
              primaryValue: segment.primaryValue,
              secondaryLabel: segment.secondaryLabel,
              secondaryValue: segment.secondaryValue,
              expectedVolume: segment.expectedVolume
            } as Prisma.InputJsonValue,
            expiresAt: normalized.expiresAt
          }
        });
        links.push(link);

        await tx.auditLog.create({
          data: {
            actorUserId: user.sub,
            entityType: "INTAKE_LINK",
            entityId: link.id,
            action: "AUTO_GENERATE_FROM_CAMPAIGN",
            newValue: {
              schoolId: link.schoolId,
              campaignId: campaign.id,
              tokenDigest: this.publicLinkAuditEntityId(link.token),
              campaignName: link.campaignName,
              institutionType: link.institutionType,
              audience: link.audience,
              className: link.className,
              section: link.section
            }
          }
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: user.sub,
          entityType: "INTAKE_CAMPAIGN",
          entityId: campaign.id,
          action,
          newValue: {
            schoolId: school.id,
            name: campaign.name,
            institutionType: campaign.institutionType,
            audience: campaign.audience,
            maxExpectedVolume: campaign.maxExpectedVolume,
            generatedLinks: links.length,
            targetSegments: normalized.targetSegments.map((segment) => ({
              label: segment.label,
              className: segment.className,
              section: segment.section,
              expectedVolume: segment.expectedVolume
            }))
          }
        }
      });

      return { campaign, links };
    });
  }

  private buildLinkStatsMap(
    rows: Array<{
      intakeLinkId: string | null;
      status: StudentStatus;
    }>
  ) {
    const map = new Map<string, LinkAggregateCounts>();
    rows.forEach((row) => {
      if (!row.intakeLinkId) return;
      const current = map.get(row.intakeLinkId) ?? { submitted: 0, approved: 0, rejected: 0, pending: 0 };
      if (row.status !== StudentStatus.DRAFT) current.submitted += 1;
      if (
        row.status === StudentStatus.SCHOOL_APPROVED ||
        row.status === StudentStatus.SALES_APPROVED ||
        row.status === StudentStatus.IN_PRINT_QUEUE ||
        row.status === StudentStatus.PRINTED ||
        row.status === StudentStatus.DELIVERED
      ) {
        current.approved += 1;
      }
      if (row.status === StudentStatus.REJECTED) current.rejected += 1;
      map.set(row.intakeLinkId, current);
    });
    map.forEach((value, key) => {
      map.set(key, {
        ...value,
        pending: Math.max(value.submitted - value.approved - value.rejected, 0)
      });
    });
    return map;
  }

  private serializeCampaign(
    campaign: {
      id: string;
      schoolId: string;
      name: string;
      institutionType: InstitutionType;
      audience: IntakeAudience;
      maxExpectedVolume: number;
      startsAt: Date;
      expiresAt: Date;
      isActive: boolean;
      targetSegmentsJson: Prisma.JsonValue;
      dataSchemaJson?: Prisma.JsonValue | null;
      submissionModelJson?: Prisma.JsonValue | null;
      approvalRulesJson?: Prisma.JsonValue | null;
      metadataJson?: Prisma.JsonValue | null;
      school?: { id: string; name: string; code: string } | null;
    },
    links: Array<{
      id: string;
      token: string;
      className: string;
      section: string;
      maxStudentsPerParent: number;
      photoBgPreference: string;
      expiresAt: Date;
      createdAt: Date;
      isActive: boolean;
      metadataJson?: Prisma.JsonValue | null;
    }>,
    linkStats: Map<string, LinkAggregateCounts>
  ) {
    const parsedSegments = this.extractCampaignSegments(campaign.targetSegmentsJson);
    const serializedLinks = links.map((link) => {
      const meta = this.asRecord(link.metadataJson);
      const stats = linkStats.get(link.id) ?? { submitted: 0, approved: 0, rejected: 0, pending: 0 };
      const primaryValue = this.normalizeSegmentValue(meta.primaryValue) || this.normalizeSegmentValue(link.className, true);
      const secondaryValue = this.normalizeSegmentValue(meta.secondaryValue) || this.normalizeSegmentValue(link.section, true);
      const primaryLabel = this.normalizeSegmentValue(meta.primaryLabel) || this.getCampaignDescriptor(campaign.institutionType).primaryLabel;
      const secondaryLabel = this.normalizeSegmentValue(meta.secondaryLabel) || this.getCampaignDescriptor(campaign.institutionType).secondaryLabel;
      return {
        id: link.id,
        token: link.token,
        className: link.className,
        section: link.section,
        segmentKey: this.normalizeSegmentValue(meta.segmentKey) || `${link.className}__${link.section}`,
        segmentLabel:
          this.normalizeSegmentValue(meta.segmentLabel) ||
          this.buildSegmentLabel(campaign.institutionType, primaryLabel, primaryValue, secondaryLabel, secondaryValue),
        primaryLabel,
        primaryValue: primaryValue || link.className,
        secondaryLabel,
        secondaryValue,
        expectedVolume: this.normalizeOptionalNumber(meta.expectedVolume) ?? 0,
        maxStudentsPerParent: link.maxStudentsPerParent,
        photoBgPreference: link.photoBgPreference,
        expiresAt: link.expiresAt,
        createdAt: link.createdAt,
        isActive: link.isActive,
        submitted: stats.submitted,
        approved: stats.approved,
        rejected: stats.rejected,
        pending: stats.pending
      };
    });

    const fallbackSegments = serializedLinks.map((link) => ({
      segmentKey: link.segmentKey,
      label: link.segmentLabel,
      primaryLabel: link.primaryLabel,
      primaryValue: link.primaryValue,
      secondaryLabel: link.secondaryLabel,
      secondaryValue: link.secondaryValue,
      expectedVolume: link.expectedVolume,
      className: link.className,
      section: link.section
    }));

    const campaignSegments = (parsedSegments.length ? parsedSegments : fallbackSegments).map((segment) => {
      const linked = serializedLinks.filter((link) => link.segmentKey === segment.segmentKey);
      const totals = linked.reduce(
        (acc, link) => ({
          submitted: acc.submitted + link.submitted,
          approved: acc.approved + link.approved,
          rejected: acc.rejected + link.rejected,
          pending: acc.pending + link.pending
        }),
        { submitted: 0, approved: 0, rejected: 0, pending: 0 }
      );
      return {
        ...segment,
        links: linked,
        submitted: totals.submitted,
        approved: totals.approved,
        rejected: totals.rejected,
        pending: totals.pending
      };
    });

    const totals = campaignSegments.reduce(
      (acc, segment) => ({
        expected: acc.expected + (segment.expectedVolume || 0),
        submitted: acc.submitted + segment.submitted,
        approved: acc.approved + segment.approved,
        rejected: acc.rejected + segment.rejected,
        pending: acc.pending + segment.pending
      }),
      { expected: 0, submitted: 0, approved: 0, rejected: 0, pending: 0 }
    );

    return {
      id: campaign.id,
      schoolId: campaign.schoolId,
      name: campaign.name,
      institutionType: campaign.institutionType,
      audience: campaign.audience,
      maxExpectedVolume: campaign.maxExpectedVolume,
      startsAt: campaign.startsAt,
      expiresAt: campaign.expiresAt,
      isActive: campaign.isActive,
      school: campaign.school || undefined,
      dataSchema: this.asRecord(campaign.dataSchemaJson),
      submissionModel: this.asRecord(campaign.submissionModelJson),
      approvalRules: this.asRecord(campaign.approvalRulesJson),
      metadata: this.asRecord(campaign.metadataJson),
      targetSegments: campaignSegments,
      links: serializedLinks,
      totals: {
        generatedLinks: serializedLinks.length,
        expected: totals.expected,
        submitted: totals.submitted,
        approved: totals.approved,
        rejected: totals.rejected,
        pending: totals.pending
      }
    };
  }

  private extractCampaignSegments(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value
      .map((entry) => {
        const segment = this.asRecord(entry);
        const className = this.normalizeSegmentValue(segment.className, true);
        const normalizedSection = this.normalizeSegmentValue(segment.section, true) || "ALL";
        const primaryLabel = this.normalizeSegmentValue(segment.primaryLabel) || "Segment";
        const secondaryLabel = this.normalizeSegmentValue(segment.secondaryLabel);
        const primaryValue = this.normalizeSegmentValue(segment.primaryValue) || className;
        const secondaryValue = this.normalizeSegmentValue(segment.secondaryValue);
        const segmentKey =
          this.normalizeSegmentValue(segment.segmentKey) ||
          `${(className || "").toUpperCase()}__${normalizedSection.toUpperCase()}`;
        if (!className) return null;
        return {
          segmentKey,
          label:
            this.normalizeSegmentValue(segment.label) ||
            this.buildGenericSegmentLabel(primaryLabel, primaryValue, secondaryLabel, secondaryValue),
          primaryLabel,
          primaryValue: primaryValue || className,
          secondaryLabel,
          secondaryValue,
          expectedVolume: this.normalizeOptionalNumber(segment.expectedVolume) ?? 0,
          className: className.toUpperCase(),
          section: normalizedSection.toUpperCase()
        };
      })
      .filter((value): value is NormalizedCampaignSegment => value !== null);
  }

  private getCampaignDescriptor(institutionType: InstitutionType) {
    if (institutionType === InstitutionType.COLLEGE) {
      return {
        label: "College",
        primaryLabel: "Department",
        secondaryLabel: "Year",
        defaultAudience: IntakeAudience.STUDENT,
        submissionDefaults: {
          mode: "STUDENT_SELF_FILL",
          actorType: "STUDENT",
          requirePhotoStandardization: true,
          requireParentOtp: false,
          distributionChannels: ["WHATSAPP", "SMS"],
          bulkUploadEnabled: true,
          intakeLinkOptional: true,
          allowMobileEditAfterVerification: false,
          duplicatePolicy: "ONE_PER_STUDENT"
        }
      };
    }
    if (institutionType === InstitutionType.COMPANY) {
      return {
        label: "Corporate",
        primaryLabel: "Department",
        secondaryLabel: "Role",
        defaultAudience: IntakeAudience.EMPLOYEE,
        submissionDefaults: {
          mode: "EMPLOYEE_SELF_FILL",
          actorType: "STAFF",
          requirePhotoStandardization: true,
          requireParentOtp: false,
          distributionChannels: ["EMAIL", "WHATSAPP"],
          bulkUploadEnabled: true,
          intakeLinkOptional: false,
          allowMobileEditAfterVerification: false,
          duplicatePolicy: "ONE_PER_STUDENT"
        }
      };
    }
    if (institutionType === InstitutionType.COACHING_INSTITUTE) {
      return {
        label: "Coaching Institute",
        primaryLabel: "Batch",
        secondaryLabel: "Section",
        defaultAudience: IntakeAudience.STUDENT,
        submissionDefaults: {
          mode: "STUDENT_SELF_FILL",
          actorType: "STUDENT",
          requirePhotoStandardization: true,
          requireParentOtp: false,
          distributionChannels: ["WHATSAPP", "SMS"],
          bulkUploadEnabled: true,
          intakeLinkOptional: false,
          allowMobileEditAfterVerification: false,
          duplicatePolicy: "ONE_PER_STUDENT"
        }
      };
    }
    return {
      label: "School",
      primaryLabel: "Class",
      secondaryLabel: "Division",
      defaultAudience: IntakeAudience.PARENT,
      submissionDefaults: {
        mode: "PARENT_DRIVEN",
        actorType: "PARENT",
        requirePhotoStandardization: true,
        requireParentOtp: false,
        distributionChannels: ["WHATSAPP", "SMS"],
        bulkUploadEnabled: false,
        intakeLinkOptional: false,
        allowMobileEditAfterVerification: false,
        duplicatePolicy: "ONE_PER_STUDENT"
      }
    };
  }

  private normalizeRegistrationData(dto: CreateSchoolDto) {
    if (!dto.registrationData) return null;

    const root = this.asRecord(dto.registrationData);
    const identity = this.asRecord(root.identity);
    const location = this.asRecord(identity.location);
    const authority = this.asRecord(root.authority);
    const primaryDecisionMaker = this.asRecord(authority.primaryDecisionMaker);
    const operationalContact = this.asRecord(authority.operationalContact);
    const procurementContact = this.asRecord(authority.procurementContact);
    const escalation = this.asRecord(authority.escalation);
    const secondaryContact = this.asRecord(escalation.secondaryContact);
    const configuration = this.asRecord(root.configuration);
    const idCard = this.asRecord(configuration.idCard);
    const cardTypes = this.asRecord(idCard.cardTypes);
    const dataFields = this.asRecord(idCard.dataFields);
    const volumeScale = this.asRecord(configuration.volumeScale);
    const workflow = this.asRecord(configuration.workflow);
    const delivery = this.asRecord(configuration.delivery);

    const normalized: NormalizedInstitutionRegistration = {
      identity: {
        institutionName: dto.name.trim(),
        institutionType: dto.institutionType || InstitutionType.SCHOOL,
        boardAffiliation: this.normalizeString(identity.boardAffiliation),
        affiliationNumber: this.normalizeString(identity.affiliationNumber),
        yearEstablished: this.normalizeOptionalNumber(identity.yearEstablished),
        location: {
          street: this.normalizeString(location.street),
          area: this.normalizeString(location.area),
          city: this.normalizeString(location.city),
          state: this.normalizeString(location.state),
          pinCode: this.normalizeString(location.pinCode),
          latitude: this.normalizeOptionalNumber(location.latitude),
          longitude: this.normalizeOptionalNumber(location.longitude),
          campusType: this.normalizeEnum(location.campusType, ["SINGLE", "MULTI_CAMPUS"], "SINGLE")
        }
      },
      authority: {
        primaryDecisionMaker: {
          title: this.normalizeOptionalString(primaryDecisionMaker.title),
          name: this.normalizeString(primaryDecisionMaker.name),
          email: this.normalizeEmail(primaryDecisionMaker.email),
          phone: this.normalizeString(primaryDecisionMaker.phone)
        },
        operationalContact: {
          title: this.normalizeOptionalString(operationalContact.title),
          name: this.normalizeString(operationalContact.name),
          phone: this.normalizeString(operationalContact.phone),
          whatsapp: this.normalizeString(operationalContact.whatsapp),
          email: this.normalizeEmail(operationalContact.email)
        },
        procurementContact: {
          name: this.normalizeOptionalString(procurementContact.name),
          email: this.normalizeOptionalEmail(procurementContact.email),
          phone: this.normalizeOptionalString(procurementContact.phone)
        },
        escalation: {
          secondaryContact: {
            name: this.normalizeOptionalString(secondaryContact.name),
            email: this.normalizeOptionalEmail(secondaryContact.email),
            phone: this.normalizeOptionalString(secondaryContact.phone)
          },
          approvalAuthorityFlag: this.normalizeBoolean(escalation.approvalAuthorityFlag)
        }
      },
      configuration: {
        idCard: {
          cardTypes: {
            studentId: this.normalizeBoolean(cardTypes.studentId),
            staffId: this.normalizeBoolean(cardTypes.staffId),
            visitorId: this.normalizeBoolean(cardTypes.visitorId),
            smartCards: this.normalizeBoolean(cardTypes.smartCards)
          },
          dataFields: {
            name: this.normalizeBoolean(dataFields.name),
            photo: this.normalizeBoolean(dataFields.photo),
            standard: this.normalizeBoolean(dataFields.standard),
            className: this.normalizeBoolean(dataFields.className),
            division: this.normalizeBoolean(dataFields.division),
            department: this.normalizeBoolean(dataFields.department),
            idNumber: this.normalizeBoolean(dataFields.idNumber),
            dob: this.normalizeBoolean(dataFields.dob),
            bloodGroup: this.normalizeBoolean(dataFields.bloodGroup),
            address: this.normalizeBoolean(dataFields.address),
            parentName: this.normalizeBoolean(dataFields.parentName),
            emergencyContact: this.normalizeBoolean(dataFields.emergencyContact)
          },
          customFields: this.normalizeStringArray(idCard.customFields)
        },
        volumeScale: {
          totalStudents: this.normalizeRequiredNumber(volumeScale.totalStudents, "Total Students"),
          totalStaff: this.normalizeRequiredNumber(volumeScale.totalStaff, "Total Staff"),
          expectedAnnualAdditions: this.normalizeRequiredNumber(
            volumeScale.expectedAnnualAdditions,
            "Expected Annual Additions"
          ),
          classesOrDepartmentsStructure: this.normalizeString(volumeScale.classesOrDepartmentsStructure)
        },
        workflow: {
          approvalRequired: this.normalizeBoolean(workflow.approvalRequired),
          approvalLevels: this.normalizeEnum(workflow.approvalLevels, ["SINGLE", "MULTI_LEVEL"], "SINGLE"),
          autoApprovalThreshold: this.normalizeOptionalNumber(workflow.autoApprovalThreshold)
        },
        delivery: {
          model: this.normalizeEnum(delivery.model, ["CENTRALIZED", "PER_CLASS"], "CENTRALIZED"),
          dispatchAddressConfirmation: this.normalizeBoolean(delivery.dispatchAddressConfirmation)
        }
      }
    };

    const missing: string[] = [];
    if (!normalized.identity.boardAffiliation) missing.push("Board / Affiliation");
    if (!normalized.identity.affiliationNumber) missing.push("Affiliation Number");
    if (!normalized.identity.location.street) missing.push("Street Address");
    if (!normalized.identity.location.area) missing.push("Area");
    if (!normalized.identity.location.city) missing.push("City");
    if (!normalized.identity.location.state) missing.push("State");
    if (!normalized.identity.location.pinCode) missing.push("PIN Code");
    if (!normalized.authority.primaryDecisionMaker.name) missing.push("Primary Decision Maker Name");
    if (!normalized.authority.primaryDecisionMaker.email) missing.push("Primary Decision Maker Email");
    if (!normalized.authority.primaryDecisionMaker.phone) missing.push("Primary Decision Maker Phone");
    if (!normalized.authority.operationalContact.name) missing.push("Operational Contact Name");
    if (!normalized.authority.operationalContact.phone) missing.push("Operational Contact Phone");
    if (!normalized.authority.operationalContact.whatsapp) missing.push("Operational Contact WhatsApp");
    if (!normalized.authority.operationalContact.email) missing.push("Operational Contact Email");

    const selectedCardTypes =
      normalized.configuration.idCard.cardTypes.studentId ||
      normalized.configuration.idCard.cardTypes.staffId ||
      normalized.configuration.idCard.cardTypes.visitorId;
    if (!selectedCardTypes) missing.push("At least one card type");

    if (missing.length) {
      throw new BadRequestException(`Missing required institution registration fields: ${missing.join(", ")}`);
    }

    return normalized;
  }

  private composeAddressFromRegistration(registrationData: NormalizedInstitutionRegistration) {
    return [
      registrationData.identity.location.street,
      registrationData.identity.location.area,
      registrationData.identity.location.city,
      registrationData.identity.location.state,
      registrationData.identity.location.pinCode
    ]
      .filter(Boolean)
      .join(", ");
  }

  private asRecord(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private normalizeString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
  }

  private normalizeOptionalString(value: unknown) {
    const normalized = this.normalizeString(value);
    return normalized || null;
  }

  private normalizeSegmentValue(value: unknown, allowAll = false) {
    const normalized = this.normalizeString(value);
    if (!normalized) return null;
    const lowered = normalized.toLowerCase();
    if (["na", "n/a", "null", "undefined", "-", "--"].includes(lowered)) return null;
    if (!allowAll && lowered === "all") return null;
    return normalized;
  }

  private buildGenericSegmentLabel(
    primaryLabel: string,
    primaryValue?: string | null,
    secondaryLabel?: string | null,
    secondaryValue?: string | null
  ) {
    const primary = this.normalizeSegmentValue(primaryValue);
    const secondary = this.normalizeSegmentValue(secondaryValue);
    if (!primary) return "Segment pending";
    if (!secondary) return `${primaryLabel} ${primary}`;
    return `${primaryLabel} ${primary} • ${secondaryLabel || "Segment"} ${secondary}`;
  }

  private buildSegmentLabel(
    institutionType: InstitutionType,
    primaryLabel: string,
    primaryValue?: string | null,
    secondaryLabel?: string | null,
    secondaryValue?: string | null
  ) {
    const rawPrimary = this.normalizeString(primaryValue).toLowerCase();
    const rawSecondary = this.normalizeString(secondaryValue).toLowerCase();
    if (rawPrimary === "all" && (!rawSecondary || rawSecondary === "all")) {
      return "Open Intake";
    }
    const primary = this.normalizeSegmentValue(primaryValue);
    const secondary = this.normalizeSegmentValue(secondaryValue);
    if (!primary) return "Segment pending";
    if (institutionType === InstitutionType.SCHOOL) {
      return secondary ? `Class ${primary} - Division ${secondary}` : `Class ${primary}`;
    }
    if (institutionType === InstitutionType.COLLEGE) {
      return secondary ? `${primary} • Year ${secondary}` : primary;
    }
    if (institutionType === InstitutionType.COMPANY) {
      return secondary ? `${primary} • ${secondaryLabel || "Role"} ${secondary}` : primary;
    }
    return this.buildGenericSegmentLabel(primaryLabel, primary, secondaryLabel, secondary);
  }

  private normalizeEmail(value: unknown) {
    return this.normalizeString(value).toLowerCase();
  }

  private normalizeOptionalEmail(value: unknown) {
    const normalized = this.normalizeEmail(value);
    return normalized || null;
  }

  private normalizeOptionalNumber(value: unknown) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private normalizeRequiredNumber(value: unknown, fieldName: string) {
    const parsed = this.normalizeOptionalNumber(value);
    if (parsed === null) throw new BadRequestException(`${fieldName} is required`);
    return parsed;
  }

  private normalizeBoolean(value: unknown) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value.trim().toLowerCase() === "true";
    return false;
  }

  private normalizeEnum<T extends string>(value: unknown, options: readonly T[], fallback: T) {
    const normalized = this.normalizeString(value) as T;
    return options.includes(normalized) ? normalized : fallback;
  }

  private normalizeStringArray(value: unknown) {
    if (Array.isArray(value)) {
      return value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean);
    }
    if (typeof value === "string") {
      return value
        .split(/[\n,]/)
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
    return [];
  }

  private async generateSchoolCode() {
    const existingCodes = await this.prisma.school.findMany({
      where: {
        code: {
          startsWith: SCHOOL_CODE_PREFIX
        }
      },
      select: {
        code: true
      }
    });

    let highestAllocatedNumber = 0;
    for (const row of existingCodes) {
      const match = row.code.match(/^SA(\d+)$/);
      if (!match) continue;
      const allocatedNumber = Number.parseInt(match[1], 10);
      if (Number.isFinite(allocatedNumber)) {
        highestAllocatedNumber = Math.max(highestAllocatedNumber, allocatedNumber);
      }
    }

    const nextNumber = highestAllocatedNumber + 1;
    return `${SCHOOL_CODE_PREFIX}${String(nextNumber).padStart(SCHOOL_CODE_PADDING, "0")}`;
  }

  private isSchoolCodeConflict(error: unknown) {
    const maybe = error as { code?: string; meta?: { target?: string | string[] } };
    if (maybe?.code !== "P2002") return false;
    const target = maybe.meta?.target;
    if (Array.isArray(target)) return target.includes("code");
    if (typeof target === "string") return target.includes("code");
    return true;
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
      formSchema?: Prisma.JsonValue | null;
      metadataJson?: Prisma.JsonValue | null;
      school: { name: string; code: string };
      campaign?: {
        id: string;
        name: string;
        maxExpectedVolume: number;
        startsAt: Date;
        expiresAt: Date;
        targetSegmentsJson: Prisma.JsonValue;
        dataSchemaJson?: Prisma.JsonValue | null;
        submissionModelJson?: Prisma.JsonValue | null;
        approvalRulesJson?: Prisma.JsonValue | null;
        metadataJson?: Prisma.JsonValue | null;
      } | null;
    }
  ) {
    const linkMeta = this.asRecord(link.metadataJson);
    const descriptor = this.getCampaignDescriptor(link.institutionType);
    const primaryValue = this.normalizeSegmentValue(linkMeta.primaryValue) || this.normalizeSegmentValue(link.className, true);
    const secondaryValue = this.normalizeSegmentValue(linkMeta.secondaryValue) || this.normalizeSegmentValue(link.section, true);
    const submissionModel = link.campaign
      ? this.asRecord(link.campaign.submissionModelJson)
      : this.asRecord(this.asRecord(link.formSchema).submissionModel);
    const actorType =
      this.normalizeSegmentValue(submissionModel.actorType, true) ||
      (link.audience === IntakeAudience.PARENT
        ? "PARENT"
        : link.audience === IntakeAudience.STUDENT
          ? "STUDENT"
          : "STAFF");
    return {
      token: link.token,
      campaignName: link.campaignName,
      institutionType: link.institutionType,
      audience: link.audience,
      actorType,
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
      school: link.school,
      segment: {
        segmentKey: this.normalizeSegmentValue(linkMeta.segmentKey),
        segmentLabel:
          this.normalizeSegmentValue(linkMeta.segmentLabel) ||
          this.buildSegmentLabel(
            link.institutionType,
            descriptor.primaryLabel,
            primaryValue,
            descriptor.secondaryLabel,
            secondaryValue
          ),
        primaryLabel: this.normalizeSegmentValue(linkMeta.primaryLabel) || descriptor.primaryLabel,
        primaryValue,
        secondaryLabel: this.normalizeSegmentValue(linkMeta.secondaryLabel) || descriptor.secondaryLabel,
        secondaryValue,
        expectedVolume: this.normalizeOptionalNumber(linkMeta.expectedVolume)
      },
      campaign: link.campaign
        ? {
            id: link.campaign.id,
            name: link.campaign.name,
            maxExpectedVolume: link.campaign.maxExpectedVolume,
            startsAt: link.campaign.startsAt,
            expiresAt: link.campaign.expiresAt,
            actorType,
            targetSegments: this.extractCampaignSegments(link.campaign.targetSegmentsJson),
            message:
              actorType === "PARENT"
                ? "Verify parent mobile to start this intake."
                : actorType === "STUDENT"
                  ? "Verify student mobile to start this intake."
                  : "Verify staff mobile to start this intake."
          }
        : undefined
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
