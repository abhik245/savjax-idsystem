import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { IntakeAudience, IntakeSubmissionStage, Prisma, StudentStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthenticatedUser } from "../../common/auth/auth-user.type";
import { AnalyzePhotoDto } from "./dto/analyze-photo.dto";
import { SubmitStudentDto } from "./dto/submit-student.dto";
import { FaceIntelligenceService } from "../../common/services/face-intelligence.service";
import { DataProtectionService } from "../../common/services/data-protection.service";
import { TemplateRenderService } from "../../common/services/template-render.service";

@Injectable()
export class ParentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly faceIntelligenceService: FaceIntelligenceService,
    private readonly dataProtectionService: DataProtectionService,
    private readonly templateRenderService: TemplateRenderService
  ) {}

  async analyzePhoto(dto: AnalyzePhotoDto, user: AuthenticatedUser) {
    const { parent, link } = await this.resolveParentAndLink(
      user,
      dto.intakeToken,
      undefined,
      undefined,
      true
    );

    const photo = await this.faceIntelligenceService.processPhoto({
      photoDataUrl: dto.photoDataUrl,
      photoKey: dto.photoKey,
      schoolId: link.schoolId,
      intakeToken: dto.intakeToken,
      photoBgPreference: link.photoBgPreference
    });
    const analysisId = this.faceIntelligenceService.createAnalysisTicket({
      parentId: parent.id,
      schoolId: link.schoolId,
      intakeToken: dto.intakeToken,
      result: photo
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
        institutionType: link.institutionType
      }
    };
  }

  async submitStudent(dto: SubmitStudentDto, user: AuthenticatedUser) {
    const { parent, link } = await this.resolveParentAndLink(
      user,
      dto.intakeToken,
      dto.parentMobile || dto.mobile,
      dto.className || dto.segmentPrimaryValue,
      false,
      dto.section || dto.segmentSecondaryValue
    );

    const className = this.normalizeString(dto.className || dto.segmentPrimaryValue) || (link.className === "ALL" ? "" : link.className);
    const section = this.normalizeString(dto.section || dto.segmentSecondaryValue) || (link.section === "ALL" ? "" : link.section);
    const fullName = this.normalizeString(dto.fullName);
    const parentName = this.normalizeString(dto.parentName) || "Parent";
    const parentMobile =
      this.normalizeMobile(dto.parentMobile || dto.mobile) ||
      this.normalizeMobile(this.dataProtectionService.decryptText(parent.mobileCiphertext, parent.mobile));
    const address = this.normalizeString(dto.address);
    const rollNumber = this.normalizeString(dto.rollNumber) || (await this.generateAutoRollNumber(link.id));
    const workflowRequired = this.readBoolean(
      this.asRecord(this.asRecord(link.formSchema).submissionModel),
      "workflowRequired",
      true
    );

    if (!fullName) throw new BadRequestException("Student name is required");
    if (!className) throw new BadRequestException("Class is required");
    if (!section) throw new BadRequestException("Section is required");
    if (!parentMobile) throw new BadRequestException("Parent mobile is required");

    const siblingLimit = link.allowSiblings ? link.maxStudentsPerParent : 1;
    const siblingCount = await this.prisma.student.count({
      where: { intakeLinkId: link.id, parentId: parent.id, deletedAt: null }
    });
    if (siblingCount >= siblingLimit) {
      throw new BadRequestException("Sibling limit reached for this campaign");
    }

    const duplicateKey = [
      fullName.toLowerCase(),
      className.toUpperCase(),
      section.toUpperCase(),
      rollNumber.toLowerCase()
    ].join("|");

    const duplicateExists = await this.prisma.student.findFirst({
      where: { schoolId: link.schoolId, duplicateKey, deletedAt: null },
      select: { id: true }
    });

    const ticketPhoto =
      dto.photoAnalysisId && parent.id
        ? this.faceIntelligenceService.consumeAnalysisTicket({
            ticketId: dto.photoAnalysisId,
            parentId: parent.id,
            schoolId: link.schoolId,
            intakeToken: dto.intakeToken
          })
        : null;
    const photo =
      ticketPhoto ||
      (await this.faceIntelligenceService.processPhoto({
        photoDataUrl: dto.photoDataUrl,
        photoKey: dto.photoKey,
        schoolId: link.schoolId,
        intakeToken: dto.intakeToken,
        photoBgPreference: link.photoBgPreference
      }));

    const student = await this.prisma.student.create({
      data: {
        schoolId: link.schoolId,
        parentId: parent.id,
        intakeLinkId: link.id,
        fullName,
        parentName: this.dataProtectionService.maskName(parentName) || parentName,
        parentNameCiphertext: this.dataProtectionService.encryptText(parentName),
        parentMobile: this.dataProtectionService.maskPhone(parentMobile) || parentMobile,
        parentMobileCiphertext: this.dataProtectionService.encryptText(parentMobile),
        className: className.toUpperCase(),
        section: section.toUpperCase(),
        rollNumber,
        address: this.dataProtectionService.maskAddress(address) || address,
        addressCiphertext: this.dataProtectionService.encryptText(address),
        photoKey: photo.photoKey,
        status: StudentStatus.SUBMITTED,
        intakeStage: workflowRequired ? IntakeSubmissionStage.UNDER_REVIEW : IntakeSubmissionStage.SUBMITTED,
        duplicateKey,
        duplicateFlag: !!duplicateExists,
        photoQualityStatus: photo.photoQualityStatus,
        photoQualityScore: photo.photoQualityScore,
        photoAnalysisJson: photo.photoAnalysisJson as Prisma.InputJsonValue
      }
    });
    await this.prisma.parentSubmission.create({
      data: {
        schoolId: link.schoolId,
        studentId: student.id,
        submittedAt: new Date(),
        payloadJson: {
          intakeToken: dto.intakeToken,
          fullName,
          className,
          section,
          rollNumber,
          campaignName: link.campaignName,
          institutionType: link.institutionType,
          audience: link.audience,
          stage: workflowRequired ? IntakeSubmissionStage.UNDER_REVIEW : IntakeSubmissionStage.SUBMITTED,
          photoQualityStatus: photo.photoQualityStatus,
          photoQualityScore: photo.photoQualityScore,
          photoWarnings: this.faceIntelligenceService.getWarnings(photo)
        },
        payloadCiphertext: this.dataProtectionService.encryptJson({
          intakeToken: dto.intakeToken,
          fullName,
          parentName,
          parentMobile,
          className,
          section,
          rollNumber,
          address,
          campaignName: link.campaignName,
          institutionType: link.institutionType,
          audience: link.audience,
          stage: workflowRequired ? IntakeSubmissionStage.UNDER_REVIEW : IntakeSubmissionStage.SUBMITTED,
          photoQualityStatus: photo.photoQualityStatus,
          photoQualityScore: photo.photoQualityScore,
          photoWarnings: this.faceIntelligenceService.getWarnings(photo)
        })
      }
    });

    const template = link.templateId
      ? await this.prisma.template.findFirst({
          where: { id: link.templateId, schoolId: link.schoolId, deletedAt: null }
        })
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
              parentMobile,
              address
            },
            {
              id: link.schoolId,
              name: link.school?.name || "School",
              code: link.school?.code || "",
              email: null
            },
            template.lastSnapshotVersion || 1,
            {
              photoKey: student.photoKey,
              photoBgPreference: link.photoBgPreference,
              campaignName: link.campaignName,
              institutionType: link.institutionType
            }
          ) as Prisma.InputJsonValue
        }
      });
    }

    const studentResponse = this.serializeStudentForParent(student);

    return {
      student: studentResponse,
      proof,
      photoAnalysis: {
        status: photo.photoQualityStatus,
        score: photo.photoQualityScore
      },
      linkPreference: {
        photoBgPreference: link.photoBgPreference,
        allowSiblings: link.allowSiblings,
        maxStudentsPerParent: siblingLimit,
        campaignName: link.campaignName
      }
    };
  }

  async listMySubmissions(user: AuthenticatedUser) {
    if (!user.parentId) throw new ForbiddenException("Parent profile not found");
    const rows = await this.prisma.student.findMany({
      where: { parentId: user.parentId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    return rows.map((row) => this.serializeStudentForParent(row));
  }

  private async resolveParentAndLink(
    user: AuthenticatedUser,
    intakeToken: string,
    parentMobile?: string,
    className?: string,
    allowClassSectionSkip = false,
    section?: string
  ) {
    if (!user.parentId) throw new ForbiddenException("Parent profile not found");
    const parent = await this.prisma.parent.findUnique({
      where: { id: user.parentId }
    });
    if (!parent) throw new ForbiddenException("Parent profile not found");
    const resolvedParentMobile = this.dataProtectionService.decryptText(parent.mobileCiphertext, parent.mobile);
    if (parentMobile && this.normalizeMobile(resolvedParentMobile) !== this.normalizeMobile(parentMobile)) {
      throw new ForbiddenException("Parent mobile mismatch");
    }

    const link = await this.prisma.intakeLink.findUnique({
      where: { token: intakeToken },
      include: { school: { select: { id: true, name: true, code: true, email: true } } }
    });
    if (!link || link.deletedAt) throw new NotFoundException("Intake link not found");
    if (!link.isActive || link.expiresAt < new Date()) throw new ForbiddenException("Intake link expired/inactive");
    if (link.audience !== IntakeAudience.PARENT) {
      throw new ForbiddenException("This intake campaign is not configured for parent submissions");
    }

    if (!allowClassSectionSkip && className) {
      if (link.className !== "ALL" && link.className !== className.toUpperCase()) {
        throw new BadRequestException("Class mismatch for intake link");
      }
      if (section && link.section !== "ALL" && link.section !== section.toUpperCase()) {
        throw new BadRequestException("Section mismatch for intake link");
      }
    }

    return { parent, link };
  }

  private async generateAutoRollNumber(intakeLinkId: string) {
    const count = await this.prisma.student.count({
      where: { intakeLinkId, deletedAt: null }
    });
    return `ID-${String(count + 1).padStart(4, "0")}`;
  }

  private asRecord(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private readBoolean(record: Record<string, unknown>, key: string, fallback = false) {
    const value = record[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value.trim().toLowerCase() === "true";
    return fallback;
  }

  private normalizeString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
  }

  private normalizeMobile(value: unknown) {
    const digits = this.normalizeString(value).replace(/\D/g, "");
    return digits.length === 10 ? digits : "";
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

  private serializeStudentForParent<
    T extends {
      parentName?: string | null;
      parentMobile?: string | null;
      address?: string | null;
      parentNameCiphertext?: string | null;
      parentMobileCiphertext?: string | null;
      addressCiphertext?: string | null;
    }
  >(row: T) {
    const hydrated = this.hydrateStudentSensitiveFields(row);
    const {
      parentNameCiphertext: _parentNameCiphertext,
      parentMobileCiphertext: _parentMobileCiphertext,
      addressCiphertext: _addressCiphertext,
      ...rest
    } = hydrated as T & {
      parentNameCiphertext?: string | null;
      parentMobileCiphertext?: string | null;
      addressCiphertext?: string | null;
    };
    return rest;
  }
}
