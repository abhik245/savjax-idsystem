import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  InstitutionType,
  IntakeActorType,
  IntakeAudience,
  IntakeOtpStatus,
  IntakeSessionStatus,
  IntakeSubmissionStage,
  Prisma,
  StudentStatus
} from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import { Role } from "../../common/enums/role.enum";
import { DataProtectionService } from "../../common/services/data-protection.service";
import { FaceIntelligenceService } from "../../common/services/face-intelligence.service";
import { TemplateRenderService } from "../../common/services/template-render.service";
import { PrismaService } from "../../prisma/prisma.service";
import { AnalyzePhotoDto } from "./dto/analyze-photo.dto";
import { SaveIntakeDraftDto } from "./dto/save-intake-draft.dto";
import { StartIntakeOtpDto } from "./dto/start-intake-otp.dto";
import { SubmitStudentDto } from "./dto/submit-student.dto";
import { VerifyIntakeOtpDto } from "./dto/verify-intake-otp.dto";

const OTP_WINDOW_MS = 10 * 60 * 1000;
const OTP_SEND_LIMIT = 6;
const OTP_VERIFY_LIMIT = 12;
const OTP_TTL_MS = 5 * 60 * 1000;
const VERIFIED_SESSION_TTL_MS = 60 * 60 * 1000;

type RequestContext = {
  ip?: string | null;
  userAgent?: string | null;
};

type LoadedLink = Awaited<ReturnType<PublicIntakeService["loadLink"]>>;
type LoadedSession = Awaited<ReturnType<PublicIntakeService["resolveVerifiedSession"]>>;

@Injectable()
export class PublicIntakeService {
  private readonly logger = new Logger(PublicIntakeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly faceIntelligenceService: FaceIntelligenceService,
    private readonly dataProtectionService: DataProtectionService,
    private readonly templateRenderService: TemplateRenderService,
    private readonly configService: ConfigService
  ) {}

  async startOtp(dto: StartIntakeOtpDto, context: RequestContext = {}) {
    const link = await this.loadLink(dto.intakeToken);
    const mobileNumber = this.normalizeMobile(dto.mobile);
    if (!mobileNumber) throw new BadRequestException("Enter a valid 10-digit mobile number");

    await this.assertOtpSendAllowed(link, mobileNumber, context);

    const otpCode = this.generateOtpCode();
    const submissionModel = this.readSubmissionModel(link);
    const actorType = this.resolveActorType(link, submissionModel);

    const session = await this.prisma.intakeAuthSession.create({
      data: {
        campaignId: link.campaignId || null,
        intakeLinkId: link.id,
        mobileNumber,
        otpHash: this.hash(otpCode),
        otpStatus: IntakeOtpStatus.PENDING,
        actorType,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        sessionStatus: IntakeSessionStatus.OTP_PENDING,
        allowMobileEdit: submissionModel.allowMobileEditAfterVerification,
        duplicatePolicy: submissionModel.duplicatePolicy,
        ipAddress: context.ip?.trim() || null,
        userAgent: context.userAgent?.trim() || null
      }
    });

    await this.auditSession(session.id, "OTP_REQUESTED", context, {
      intakeLinkId: link.id,
      campaignId: link.campaignId,
      actorType,
      maskedMobile: this.maskMobile(mobileNumber)
    });

    return {
      authSessionId: session.id,
      actorType,
      expiresAt: session.expiresAt,
      maskedMobile: this.maskMobile(mobileNumber),
      message: "OTP sent successfully",
      devOtp: this.shouldExposeDevOtp() ? otpCode : undefined
    };
  }

  async verifyOtp(dto: VerifyIntakeOtpDto, context: RequestContext = {}) {
    const session = await this.prisma.intakeAuthSession.findUnique({
      where: { id: dto.authSessionId },
      include: {
        intakeLink: {
          include: {
            school: { select: { id: true, name: true, code: true, email: true, address: true } },
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
        }
      }
    });

    if (!session) {
      throw new UnauthorizedException("OTP session not found");
    }

    if (session.expiresAt < new Date() || session.sessionStatus === IntakeSessionStatus.EXPIRED) {
      await this.expireSession(session.id);
      await this.auditSession(session.id, "OTP_VERIFY_FAILED", context, { reason: "EXPIRED_SESSION" });
      throw new UnauthorizedException("OTP expired");
    }

    await this.assertOtpVerifyAllowed(session.mobileNumber, context);

    if (session.otpHash !== this.hash(dto.otp)) {
      const nextAttempts = session.attempts + 1;
      await this.prisma.intakeAuthSession.update({
        where: { id: session.id },
        data: {
          attempts: nextAttempts,
          otpStatus: nextAttempts >= session.maxAttempts ? IntakeOtpStatus.FAILED : session.otpStatus,
          sessionStatus: nextAttempts >= session.maxAttempts ? IntakeSessionStatus.FAILED : session.sessionStatus,
          expiresAt: nextAttempts >= session.maxAttempts ? new Date() : session.expiresAt
        }
      });
      await this.auditSession(session.id, "OTP_VERIFY_FAILED", context, {
        reason: "INVALID_OTP",
        attempts: nextAttempts,
        maskedMobile: this.maskMobile(session.mobileNumber)
      });
      throw new UnauthorizedException("Invalid OTP");
    }

    const carriedDraft = await this.prisma.intakeAuthSession.findFirst({
      where: {
        id: { not: session.id },
        intakeLinkId: session.intakeLinkId,
        mobileNumber: session.mobileNumber,
        sessionStatus: IntakeSessionStatus.DRAFT,
        expiresAt: { gte: new Date() }
      },
      select: { draftPayloadJson: true },
      orderBy: { updatedAt: "desc" }
    });

    const verifiedAt = new Date();
    const verifiedExpiry = new Date(
      Math.min(verifiedAt.getTime() + VERIFIED_SESSION_TTL_MS, session.intakeLink.expiresAt.getTime())
    );
    const sessionToken = randomBytes(32).toString("hex");

    await this.prisma.intakeAuthSession.update({
      where: { id: session.id },
      data: {
        otpStatus: IntakeOtpStatus.VERIFIED,
        verifiedAt,
        expiresAt: verifiedExpiry,
        sessionStatus: carriedDraft?.draftPayloadJson ? IntakeSessionStatus.DRAFT : IntakeSessionStatus.VERIFIED,
        sessionTokenHash: this.hash(sessionToken),
        draftPayloadJson: carriedDraft?.draftPayloadJson as Prisma.InputJsonValue | undefined
      }
    });

    await this.auditSession(session.id, "OTP_VERIFIED", context, {
      actorType: session.actorType,
      verifiedAt: verifiedAt.toISOString()
    });
    await this.auditSession(session.id, "AUTH_SESSION_CREATED", context, {
      actorType: session.actorType,
      expiresAt: verifiedExpiry.toISOString(),
      resumedDraft: Boolean(carriedDraft?.draftPayloadJson)
    });

    return {
      message: "Mobile verified successfully",
      intakeSessionToken: sessionToken,
      expiresAt: verifiedExpiry,
      actorType: session.actorType,
      maskedMobile: this.maskMobile(session.mobileNumber),
      resumedDraft: Boolean(carriedDraft?.draftPayloadJson)
    };
  }

  async getSessionContext(sessionToken: string, context: RequestContext = {}) {
    const session = await this.resolveVerifiedSession(sessionToken, context);
    const link = session.intakeLink;
    const schema = this.readSchema(link);
    const submissionModel = this.readSubmissionModel(link);
    const primaryValue = this.segmentPrimary(link);
    const secondaryValue = this.segmentSecondary(link);

    return {
      session: {
        id: session.id,
        actorType: session.actorType,
        verifiedMobile: session.mobileNumber,
        maskedMobile: this.maskMobile(session.mobileNumber),
        otpVerifiedAt: session.verifiedAt,
        sessionStatus: session.sessionStatus,
        expiresAt: session.expiresAt
      },
      link: {
        token: link.token,
        campaignName: link.campaignName,
        institutionType: link.institutionType,
        audience: link.audience,
        photoBgPreference: link.photoBgPreference,
        school: link.school,
        segment: {
          segmentLabel: this.segmentLabel(link),
          primaryLabel: this.primaryLabel(link),
          primaryValue,
          secondaryLabel: this.secondaryLabel(link),
          secondaryValue
        }
      },
      campaign: link.campaign
        ? {
            id: link.campaign.id,
            name: link.campaign.name,
            maxExpectedVolume: link.campaign.maxExpectedVolume,
            startsAt: link.campaign.startsAt,
            expiresAt: link.campaign.expiresAt
          }
        : null,
      dataSchema: schema,
      submissionModel: {
        ...submissionModel,
        actorType: session.actorType,
        allowDraftSave: link.allowDraftSave,
        allowPhotoUpload: link.allowPhotoUpload,
        photoCaptureRequired: link.photoCaptureRequired,
        photoBgPreference: link.photoBgPreference,
        paymentRequired: link.paymentRequired
      },
      draft: this.asRecord(session.draftPayloadJson)
    };
  }

  async saveDraft(sessionToken: string, dto: SaveIntakeDraftDto, context: RequestContext = {}) {
    const session = await this.resolveVerifiedSession(sessionToken, context);
    if (!session.intakeLink.allowDraftSave) {
      throw new BadRequestException("Draft save is disabled for this intake link");
    }

    const submissionModel = this.readSubmissionModel(session.intakeLink);
    const className = this.normalizeString(dto.segmentPrimaryValue || dto.className);
    const division = this.normalizeString(dto.segmentSecondaryValue || dto.division || dto.section);
    const draftPayload = {
      fullName: this.normalizeString(dto.fullName),
      parentName: this.normalizeString(dto.parentName),
      mobile:
        submissionModel.allowMobileEditAfterVerification && this.normalizeMobile(dto.mobile)
          ? this.normalizeMobile(dto.mobile)
          : session.mobileNumber,
      className,
      division,
      rollNumber: this.normalizeString(dto.rollNumber),
      primaryValue: className,
      secondaryValue: division,
      address: this.normalizeString(dto.address),
      dob: this.normalizeString(dto.dob),
      bloodGroup: this.normalizeString(dto.bloodGroup).toUpperCase(),
      emergencyNumber: this.normalizeMobile(dto.emergencyNumber),
      aadhaarNumber: this.normalizeAadhaar(dto.aadhaarNumber)
    };

    await this.prisma.intakeAuthSession.update({
      where: { id: session.id },
      data: {
        draftPayloadJson: draftPayload as Prisma.InputJsonValue,
        sessionStatus: IntakeSessionStatus.DRAFT
      }
    });

    await this.auditSession(session.id, "DRAFT_SAVED", context, {
      hasFullName: Boolean(draftPayload.fullName),
      hasAddress: Boolean(draftPayload.address)
    });

    return {
      message: "Draft saved",
      sessionStatus: IntakeSessionStatus.DRAFT
    };
  }

  async analyzePhoto(sessionToken: string, dto: AnalyzePhotoDto, context: RequestContext = {}) {
    const session = await this.resolveVerifiedSession(sessionToken, context);
    const link = session.intakeLink;
    const photo = await this.faceIntelligenceService.processPhoto({
      photoDataUrl: dto.photoDataUrl,
      photoKey: dto.photoKey,
      schoolId: link.schoolId,
      intakeToken: link.token,
      photoBgPreference: link.photoBgPreference,
      preferredPhotoName:
        this.normalizeString(dto.preferredPhotoName) ||
        this.normalizeString(this.asRecord(session.draftPayloadJson).fullName) ||
        undefined
    });
    const analysisId = this.faceIntelligenceService.createPublicAnalysisTicket({
      schoolId: link.schoolId,
      intakeToken: link.token,
      sessionId: session.id,
      result: photo
    });

    await this.auditSession(session.id, "PHOTO_ANALYZED", context, {
      qualityStatus: photo.photoQualityStatus,
      qualityScore: photo.photoQualityScore
    });

    return {
      analysisId,
      photoKey: photo.photoKey,
      quality: {
        status: photo.photoQualityStatus,
        score: photo.photoQualityScore,
        warnings: this.faceIntelligenceService.getWarnings(photo)
      },
      campaign: {
        campaignName: link.campaignName,
        photoBgPreference: link.photoBgPreference,
        institutionType: link.institutionType,
        audience: link.audience,
        actorType: session.actorType,
        segmentLabel: this.segmentLabel(link)
      }
    };
  }

  async submit(sessionToken: string, dto: SubmitStudentDto, context: RequestContext = {}) {
    const session = await this.resolveVerifiedSession(sessionToken, context);
    const link = session.intakeLink;
    const schema = this.readSchema(link);
    const submissionModel = this.readSubmissionModel(link);
    const actorType = session.actorType;

    const verifiedMobile = session.mobileNumber;
    const visibleMobile =
      submissionModel.allowMobileEditAfterVerification && this.normalizeMobile(dto.mobile)
        ? this.normalizeMobile(dto.mobile)
        : verifiedMobile;
    const primaryValue =
      this.normalizeSegmentValue(dto.segmentPrimaryValue || dto.className) || this.segmentPrimary(link);
    const secondaryValue =
      this.normalizeSegmentValue(dto.segmentSecondaryValue || dto.division || dto.section) ||
      this.segmentSecondary(link);
    const fullName = this.normalizeString(dto.fullName);
    const parentName =
      this.normalizeString(dto.parentName) ||
      (actorType === IntakeActorType.PARENT ? "Parent" : fullName);
    const address = this.normalizeString(dto.address);
    const dob = this.normalizeString(dto.dob) || null;
    const bloodGroup = this.normalizeString(dto.bloodGroup).toUpperCase() || null;
    const requestedRollNumber = this.normalizeString(dto.rollNumber);
    const emergencyNumber = this.normalizeMobile(dto.emergencyNumber) || null;
    const aadhaarNumber = this.normalizeAadhaar(dto.aadhaarNumber) || null;
    const photoRequired = true;

    const errors: string[] = [];
    if (!fullName || fullName.length < 2) errors.push("Name is required");
    if (schema.className && !primaryValue) errors.push(`${this.primaryLabel(link)} is required`);
    if (schema.division && !secondaryValue) errors.push(`${this.secondaryLabel(link)} is required`);
    if (schema.rollNumber && !requestedRollNumber) errors.push("Roll number is required");
    if (schema.parentName && actorType === IntakeActorType.PARENT && !this.normalizeString(dto.parentName)) {
      errors.push("Parent name is required");
    }
    if (schema.mobileNumber && !verifiedMobile) {
      errors.push("Verified mobile number is required");
    }
    if (schema.fullAddress && !address) errors.push("Address is required");
    if (schema.dob && !dob) errors.push("Date of birth is required");
    if (schema.bloodGroup && !bloodGroup) errors.push("Blood group is required");
    if (schema.emergencyNumber && !emergencyNumber) errors.push("Emergency number is required");
    if (schema.aadhaarNumber && !aadhaarNumber) errors.push("Aadhaar number is required");
    if (photoRequired && !dto.photoAnalysisId && !dto.photoDataUrl && !dto.photoKey) {
      errors.push("Photo is required");
    }
    if (errors.length) throw new BadRequestException(errors.join(", "));

    await this.assertDuplicatePolicy(link, session, fullName, primaryValue || "", secondaryValue || "");

    const className = (primaryValue || "GENERAL").toUpperCase();
    const section = (secondaryValue || "GENERAL").toUpperCase();
    const duplicateKey = [fullName.toLowerCase(), className, section, verifiedMobile.toLowerCase()].join("|");
    const existing = await this.prisma.student.findFirst({
      where: this.buildStudentDuplicateWhere(link, duplicateKey),
      select: { id: true, status: true, intakeStage: true, rollNumber: true }
    });

    if (existing && existing.status !== StudentStatus.REJECTED && existing.intakeStage !== IntakeSubmissionStage.REJECTED) {
      throw new ConflictException("This intake record has already been submitted");
    }

    const capacity = this.segmentCapacity(link);
    if (capacity && !existing) {
      const count = await this.prisma.student.count({ where: { intakeLinkId: link.id, deletedAt: null } });
      if (count >= capacity) throw new BadRequestException("This intake link has reached its submission capacity");
    }

    const maxRecordsPerMobile = link.allowSiblings ? Math.max(link.maxStudentsPerParent || 1, 1) : 1;
    if (actorType === IntakeActorType.PARENT && !existing) {
      const mobileSubmissionCount = await this.prisma.parentSubmission.count({
        where: {
          verifiedMobile,
          authSession: { is: { intakeLinkId: link.id } },
          sessionStatus: IntakeSessionStatus.SUBMITTED
        }
      });
      if (mobileSubmissionCount >= maxRecordsPerMobile) {
        throw new BadRequestException("This verified mobile has reached the submission limit for this link");
      }
    }

    const submitter = await this.ensureSubmitter(
      verifiedMobile,
      actorType === IntakeActorType.PARENT ? parentName : fullName
    );
    const photo =
      (dto.photoAnalysisId
        ? this.faceIntelligenceService.consumePublicAnalysisTicket({
            ticketId: dto.photoAnalysisId,
            schoolId: link.schoolId,
            intakeToken: link.token,
            sessionId: session.id
          })
        : null) ||
      (await this.faceIntelligenceService.processPhoto({
        photoDataUrl: dto.photoDataUrl,
        photoKey: dto.photoKey,
        schoolId: link.schoolId,
        intakeToken: link.token,
        photoBgPreference: link.photoBgPreference,
        preferredPhotoName: this.normalizeString(dto.preferredPhotoName) || fullName
      }));

    const workflowRequired =
      submissionModel.workflowRequired ||
      this.readBoolean(this.asRecord(link.campaign?.approvalRulesJson), "approvalRequired", true);
    const nextStage = workflowRequired ? IntakeSubmissionStage.UNDER_REVIEW : IntakeSubmissionStage.SUBMITTED;
    const rollNumber =
      requestedRollNumber || existing?.rollNumber || (await this.generateRoll(link.id, link.institutionType));

    const studentData = {
      schoolId: link.schoolId,
      parentId: submitter.id,
      intakeLinkId: link.id,
      fullName,
      parentName: this.dataProtectionService.maskName(parentName) || parentName,
      parentNameCiphertext: this.dataProtectionService.encryptText(parentName),
      parentMobile: this.dataProtectionService.maskPhone(verifiedMobile) || verifiedMobile,
      parentMobileCiphertext: this.dataProtectionService.encryptText(verifiedMobile),
      className,
      section,
      rollNumber,
      address: this.dataProtectionService.maskAddress(address) || address,
      addressCiphertext: this.dataProtectionService.encryptText(address),
      photoKey: photo.photoKey,
      status: StudentStatus.SUBMITTED,
      intakeStage: nextStage,
      duplicateKey,
      duplicateFlag: false,
      rejectionNote: null as string | null,
      correctedAt: existing ? new Date() : null,
      photoQualityStatus: photo.photoQualityStatus,
      photoQualityScore: photo.photoQualityScore,
      photoAnalysisJson: photo.photoAnalysisJson as Prisma.InputJsonValue
    };

    const student = existing
      ? await this.prisma.student.update({ where: { id: existing.id }, data: studentData })
      : await this.prisma.student.create({ data: studentData });

    const payloadJson = {
      intakeToken: link.token,
      fullName,
      parentName: this.normalizeString(dto.parentName) || null,
      verifiedMobile,
      submittedMobile: visibleMobile || null,
      className,
      division: section,
      rollNumber,
      section,
      address: address || null,
      dob,
      bloodGroup,
      emergencyNumber,
      aadhaarNumber,
      campaignName: link.campaignName,
      institutionType: link.institutionType,
      audience: link.audience,
      actorType,
      submissionMode: submissionModel.mode,
      segmentLabel: this.segmentLabel(link),
      stage: nextStage
    };

    await this.prisma.parentSubmission.create({
      data: {
        schoolId: link.schoolId,
        studentId: student.id,
        verifiedMobile,
        otpVerifiedAt: session.verifiedAt,
        authSessionId: session.id,
        actorType,
        sessionStatus: IntakeSessionStatus.SUBMITTED,
        submittedAt: new Date(),
        payloadJson: payloadJson as Prisma.InputJsonValue,
        payloadCiphertext: this.dataProtectionService.encryptJson(payloadJson)
      }
    });

    await this.prisma.intakeAuthSession.update({
      where: { id: session.id },
      data: {
        sessionStatus: IntakeSessionStatus.SUBMITTED,
        draftPayloadJson: Prisma.JsonNull
      }
    });

    const template = link.templateId
      ? await this.prisma.template.findFirst({ where: { id: link.templateId, schoolId: link.schoolId, deletedAt: null } })
      : await this.prisma.template.findFirst({
          where: { schoolId: link.schoolId, isActive: true, deletedAt: null },
          orderBy: { updatedAt: "desc" }
        });

    let proof = null;
    if (template) {
      proof = await this.prisma.proof.create({
        data: {
          schoolId: link.schoolId,
          studentId: student.id,
          templateId: template.id,
          status: "GENERATED",
          previewJson: this.templateRenderService.buildPreviewPayload(
            template.mappingJson as Record<string, unknown>,
            {
              id: student.id,
              fullName: student.fullName,
              className: student.className,
              section: student.section,
              rollNumber: student.rollNumber,
              parentName,
              parentMobile: visibleMobile,
              address,
              bloodGroup,
              dateOfBirth: dob
            },
            {
              id: link.school.id,
              name: link.school.name,
              code: link.school.code,
              email: link.school.email,
              address: link.school.address
            },
            template.lastSnapshotVersion || 1,
            {
              photoKey: student.photoKey,
              photoBgPreference: link.photoBgPreference,
              campaignName: link.campaignName,
              institutionType: link.institutionType,
              segmentLabel: this.segmentLabel(link)
            }
          ) as Prisma.InputJsonValue
        }
      });
    }

    await this.auditSession(session.id, "SUBMISSION_CREATED", context, {
      studentId: student.id,
      intakeStage: nextStage,
      actorType
    });

    return {
      student: {
        id: student.id,
        fullName: student.fullName,
        className: student.className,
        section: student.section,
        rollNumber: student.rollNumber,
        status: student.status,
        intakeStage: student.intakeStage
      },
      proof,
      photoAnalysis: {
        status: photo.photoQualityStatus,
        score: photo.photoQualityScore
      },
      submission: {
        status: student.status,
        stage: student.intakeStage,
        verifiedMobile,
        actorType
      }
    };
  }

  private async loadLink(intakeToken: string) {
    const link = await this.prisma.intakeLink.findUnique({
      where: { token: intakeToken },
      include: {
        school: { select: { id: true, name: true, code: true, email: true, address: true } },
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
    if (!link || link.deletedAt) throw new NotFoundException("Intake link not found");
    if (!link.isActive || link.expiresAt < new Date()) throw new ForbiddenException("Intake link expired or inactive");
    return link;
  }

  private async resolveVerifiedSession(sessionToken: string, context: RequestContext = {}) {
    const normalizedToken = sessionToken.trim();
    if (!normalizedToken) throw new ForbiddenException("Authenticate before continuing");

    const session = await this.prisma.intakeAuthSession.findUnique({
      where: { sessionTokenHash: this.hash(normalizedToken) },
      include: {
        intakeLink: {
          include: {
            school: { select: { id: true, name: true, code: true, email: true, address: true } },
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
        }
      }
    });

    if (!session) {
      throw new ForbiddenException("Authenticated intake session not found");
    }
    if (
      session.otpStatus !== IntakeOtpStatus.VERIFIED ||
      !session.verifiedAt ||
      session.expiresAt < new Date() ||
      session.sessionStatus === IntakeSessionStatus.EXPIRED
    ) {
      await this.expireSession(session.id);
      await this.auditSession(session.id, "SESSION_ACCESS_DENIED", context, { reason: "EXPIRED_OR_UNVERIFIED" });
      throw new ForbiddenException("Your intake session has expired. Verify mobile again.");
    }
    if (!session.intakeLink.isActive || session.intakeLink.expiresAt < new Date()) {
      await this.auditSession(session.id, "SESSION_ACCESS_DENIED", context, { reason: "LINK_EXPIRED" });
      throw new ForbiddenException("This intake link is no longer active");
    }

    return session;
  }

  private readSchema(link: LoadedLink) {
    const record = link.campaign
      ? this.asRecord(link.campaign.dataSchemaJson)
      : this.asRecord(this.asRecord(link.formSchema).dataSchema);
    return {
      fullName: this.readBoolean(record, "fullName", this.readBoolean(record, "name", true)),
      photo: true,
      className: this.readBoolean(record, "className", this.readBoolean(record, "classOrDepartment", true)),
      division: this.readBoolean(record, "division"),
      rollNumber: this.readBoolean(record, "rollNumber"),
      dob: this.readBoolean(record, "dob"),
      bloodGroup: this.readBoolean(record, "bloodGroup"),
      parentName: this.readBoolean(record, "parentName", link.institutionType === InstitutionType.SCHOOL),
      mobileNumber: this.readBoolean(record, "mobileNumber", this.readBoolean(record, "mobile", true)),
      emergencyNumber: this.readBoolean(record, "emergencyNumber"),
      fullAddress: this.readBoolean(record, "fullAddress", this.readBoolean(record, "address")),
      aadhaarNumber: this.readBoolean(record, "aadhaarNumber"),
      rfidRequired: this.readBoolean(record, "rfidRequired")
    };
  }

  private readSubmissionModel(link: LoadedLink) {
    const record = link.campaign
      ? this.asRecord(link.campaign.submissionModelJson)
      : this.asRecord(this.asRecord(link.formSchema).submissionModel);
    return {
      mode: this.normalizeString(record.mode) || (link.audience === IntakeAudience.PARENT ? "PARENT_DRIVEN" : "SELF_FILL"),
      actorType: this.normalizeString(record.actorType),
      requirePhotoStandardization: this.readBoolean(record, "requirePhotoStandardization", true),
      requireParentOtp: true,
      workflowRequired: this.readBoolean(record, "workflowRequired", true),
      bulkUploadEnabled: this.readBoolean(record, "bulkUploadEnabled"),
      intakeLinkOptional: this.readBoolean(record, "intakeLinkOptional"),
      allowMobileEditAfterVerification: this.readBoolean(record, "allowMobileEditAfterVerification"),
      duplicatePolicy:
        this.normalizeString(record.duplicatePolicy) ||
        (link.institutionType === InstitutionType.SCHOOL ? "ONE_PER_STUDENT" : "ONE_PER_STUDENT")
    };
  }

  private resolveActorType(link: LoadedLink, submissionModel: ReturnType<PublicIntakeService["readSubmissionModel"]>) {
    const explicit = submissionModel.actorType.toUpperCase();
    if (explicit === "PARENT") return IntakeActorType.PARENT;
    if (explicit === "STUDENT") return IntakeActorType.STUDENT;
    if (explicit === "STAFF") return IntakeActorType.STAFF;
    if (link.audience === IntakeAudience.PARENT) return IntakeActorType.PARENT;
    if (link.audience === IntakeAudience.STUDENT) return IntakeActorType.STUDENT;
    return IntakeActorType.STAFF;
  }

  private async ensureSubmitter(mobileSeed: string, name: string) {
    const email = /^\d{10}$/.test(mobileSeed)
      ? `${mobileSeed}@parent.local`
      : `public.${randomBytes(10).toString("hex")}@parent.local`;
    let user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) {
      user = await this.prisma.user.create({
        data: { email, role: Role.PARENT, isActive: true, name, parent: { create: this.parentData(mobileSeed) } },
        select: { id: true }
      });
    }
    const parent = await this.prisma.parent.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (parent) return parent;
    return this.prisma.parent.create({ data: { userId: user.id, ...this.parentData(mobileSeed) }, select: { id: true } });
  }

  private async assertOtpSendAllowed(link: LoadedLink, mobile: string, context: RequestContext) {
    const ip = context.ip?.trim() || "unknown";
    const windowStart = new Date(Date.now() - OTP_WINDOW_MS);
    const [mobileCount, ipCount] = await Promise.all([
      this.prisma.intakeAuthSession.count({
        where: {
          intakeLinkId: link.id,
          mobileNumber: mobile,
          createdAt: { gte: windowStart }
        }
      }),
      this.prisma.intakeAuthSession.count({
        where: {
          intakeLinkId: link.id,
          ipAddress: ip,
          createdAt: { gte: windowStart }
        }
      })
    ]);

    if (mobileCount >= OTP_SEND_LIMIT || ipCount >= OTP_SEND_LIMIT) {
      await this.writeAuditLog({
        entityType: "INTAKE_AUTH_SESSION",
        entityId: `LINK:${link.id}`,
        action: "OTP_SEND_RATE_LIMITED",
        context,
        newValue: {
          mobileCount,
          ipCount,
          maskedMobile: this.maskMobile(mobile)
        }
      });
      throw new HttpException("Too many OTP requests. Try again later.", HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async assertOtpVerifyAllowed(mobile: string, context: RequestContext) {
    const ip = context.ip?.trim() || "unknown";
    const windowStart = new Date(Date.now() - OTP_WINDOW_MS);
    const [mobileFailures, ipFailures] = await Promise.all([
      this.prisma.auditLog.count({
        where: {
          entityType: "INTAKE_AUTH_SESSION",
          action: { in: ["OTP_VERIFY_FAILED", "OTP_VERIFY_RATE_LIMITED"] },
          newValue: {
            path: ["maskedMobile"],
            string_contains: this.maskMobile(mobile)
          },
          createdAt: { gte: windowStart }
        }
      }),
      this.prisma.auditLog.count({
        where: {
          entityType: "INTAKE_AUTH_SESSION",
          action: { in: ["OTP_VERIFY_FAILED", "OTP_VERIFY_RATE_LIMITED"] },
          ipAddress: ip,
          createdAt: { gte: windowStart }
        }
      })
    ]);

    if (mobileFailures >= OTP_VERIFY_LIMIT || ipFailures >= OTP_VERIFY_LIMIT) {
      await this.writeAuditLog({
        entityType: "INTAKE_AUTH_SESSION",
        entityId: `OTP:${this.hash(mobile).slice(0, 24)}`,
        action: "OTP_VERIFY_RATE_LIMITED",
        context,
        newValue: {
          mobileFailures,
          ipFailures,
          maskedMobile: this.maskMobile(mobile)
        }
      });
      throw new HttpException("Too many OTP attempts. Try again later.", HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async assertDuplicatePolicy(
    link: LoadedLink,
    session: LoadedSession,
    fullName: string,
    primaryValue: string,
    secondaryValue: string
  ) {
    const policy = this.readSubmissionModel(link).duplicatePolicy;
    if (policy === "ALLOW_MULTIPLE") return;

    if (policy === "ONE_PER_CAMPAIGN") {
      const existing = await this.prisma.parentSubmission.findFirst({
        where: {
          verifiedMobile: session.mobileNumber,
          authSession: this.buildSubmissionSessionScope(link)
        },
        select: { id: true }
      });
      if (existing) {
        throw new ConflictException("This verified mobile has already submitted for this campaign");
      }
      return;
    }

    const duplicateKey = [
      fullName.toLowerCase(),
      primaryValue.toUpperCase(),
      secondaryValue.toUpperCase(),
      session.mobileNumber.toLowerCase()
    ].join("|");
    const existingStudent = await this.prisma.student.findFirst({
      where: this.buildStudentDuplicateWhere(link, duplicateKey),
      select: { id: true, status: true, intakeStage: true }
    });
    if (
      existingStudent &&
      existingStudent.status !== StudentStatus.REJECTED &&
      existingStudent.intakeStage !== IntakeSubmissionStage.REJECTED
    ) {
      throw new ConflictException("This verified mobile has already submitted this record");
    }
  }

  private buildStudentDuplicateWhere(link: LoadedLink, duplicateKey: string): Prisma.StudentWhereInput {
    if (link.campaignId) {
      return {
        deletedAt: null,
        duplicateKey,
        intakeLink: {
          is: {
            campaignId: link.campaignId
          }
        }
      };
    }
    return {
      deletedAt: null,
      duplicateKey,
      intakeLinkId: link.id
    };
  }

  private buildSubmissionSessionScope(link: LoadedLink): Prisma.IntakeAuthSessionNullableRelationFilter {
    if (link.campaignId) {
      return { is: { campaignId: link.campaignId } };
    }
    return { is: { intakeLinkId: link.id } };
  }

  private async generateRoll(intakeLinkId: string, institutionType: InstitutionType) {
    const count = await this.prisma.student.count({ where: { intakeLinkId, deletedAt: null } });
    return `${institutionType === InstitutionType.COLLEGE ? "COL" : "ID"}-${String(count + 1).padStart(4, "0")}`;
  }

  private segmentCapacity(link: LoadedLink) {
    return this.normalizeOptionalNumber(this.asRecord(link.metadataJson).expectedVolume);
  }

  private segmentPrimary(link: LoadedLink) {
    return this.normalizeSegmentValue(this.asRecord(link.metadataJson).primaryValue) || this.normalizeSegmentValue(link.className, true);
  }

  private segmentSecondary(link: LoadedLink) {
    return this.normalizeSegmentValue(this.asRecord(link.metadataJson).secondaryValue) || this.normalizeSegmentValue(link.section, true);
  }

  private segmentLabel(link: LoadedLink) {
    const preferred = this.normalizeSegmentValue(this.asRecord(link.metadataJson).segmentLabel);
    if (preferred) return preferred;
    const primary = this.segmentPrimary(link);
    const secondary = this.segmentSecondary(link);
    if (primary?.toLowerCase() === "all" && (!secondary || secondary.toLowerCase() === "all")) return "Open Intake";
    if (!primary) return "Segment pending";
    if (link.institutionType === InstitutionType.SCHOOL) return secondary ? `Class ${primary} - Division ${secondary}` : `Class ${primary}`;
    if (link.institutionType === InstitutionType.COLLEGE) return secondary ? `${primary} • Year ${secondary}` : primary;
    return secondary ? `${primary} • ${secondary}` : primary;
  }

  private primaryLabel(link: LoadedLink) {
    return link.institutionType === InstitutionType.COLLEGE ? "Department" : "Class";
  }

  private secondaryLabel(link: LoadedLink) {
    return link.institutionType === InstitutionType.COLLEGE ? "Year" : "Division";
  }

  private parentData(mobile: string) {
    return {
      mobile,
      mobileHash: createHash("sha256").update(mobile).digest("hex"),
      mobileCiphertext: this.dataProtectionService.encryptText(mobile)
    };
  }

  private async expireSession(sessionId: string) {
    await this.prisma.intakeAuthSession.updateMany({
      where: { id: sessionId, sessionStatus: { not: IntakeSessionStatus.SUBMITTED } },
      data: {
        otpStatus: IntakeOtpStatus.EXPIRED,
        sessionStatus: IntakeSessionStatus.EXPIRED,
        expiresAt: new Date()
      }
    });
  }

  private generateOtpCode() {
    const isProd = this.configService.get("NODE_ENV", "development") === "production";
    if (isProd) {
      return String(Math.floor(100000 + Math.random() * 900000));
    }
    return this.configService.get("DEV_MASTER_OTP", "123456");
  }

  private shouldExposeDevOtp() {
    return (
      this.configService.get("NODE_ENV", "development") !== "production" &&
      this.configService.get("AUTH_DEV_EXPOSE_OTP", "false") === "true"
    );
  }

  private maskMobile(mobile: string) {
    const digits = mobile.replace(/\D/g, "");
    if (digits.length !== 10) return mobile;
    return `${digits.slice(0, 2)}******${digits.slice(-2)}`;
  }

  private readBoolean(record: Record<string, unknown>, key: string, fallback = false) {
    const value = record[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value.trim().toLowerCase() === "true";
    return fallback;
  }

  private asRecord(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private normalizeString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
  }

  private normalizeMobile(value: unknown) {
    const digits = this.normalizeString(value).replace(/\D/g, "");
    return digits.length === 10 ? digits : "";
  }

  private normalizeAadhaar(value: unknown) {
    const digits = this.normalizeString(value).replace(/\D/g, "");
    return digits.length === 12 ? digits : "";
  }

  private normalizeOptionalNumber(value: unknown) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private normalizeSegmentValue(value: unknown, allowAll = false) {
    const normalized = this.normalizeString(value);
    if (!normalized) return null;
    const lowered = normalized.toLowerCase();
    if (["na", "n/a", "null", "undefined", "-", "--"].includes(lowered)) return null;
    if (!allowAll && lowered === "all") return null;
    return normalized;
  }

  private hash(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }

  private async auditSession(
    sessionId: string,
    action: string,
    context: RequestContext,
    meta?: Record<string, unknown>
  ) {
    await this.writeAuditLog({
      entityType: "INTAKE_AUTH_SESSION",
      entityId: sessionId,
      action,
      context,
      newValue: meta
    });
  }

  private async writeAuditLog(args: {
    entityType: string;
    entityId: string;
    action: string;
    context: RequestContext;
    newValue?: Record<string, unknown>;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          entityType: args.entityType,
          entityId: args.entityId,
          action: args.action,
          newValue: args.newValue ? (args.newValue as Prisma.InputJsonValue) : undefined,
          ipAddress: args.context.ip?.trim() || null,
          userAgent: args.context.userAgent?.trim() || null
        }
      });
    } catch (error) {
      this.logger.warn(`Audit write failed: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }
}
