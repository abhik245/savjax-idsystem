import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsIn,
  IsString,
  Min,
  ValidateNested
} from "class-validator";
import { InstitutionType, IntakeActorType, IntakeAudience } from "@prisma/client";

export class CreateIntakeCampaignSegmentDto {
  @IsString()
  primaryValue!: string;

  @IsOptional()
  @IsString()
  secondaryValue?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedVolume?: number;
}

export class CreateIntakeCampaignDataSchemaDto {
  @IsOptional()
  @IsBoolean()
  fullName?: boolean;

  @IsOptional()
  @IsBoolean()
  name?: boolean;

  @IsOptional()
  @IsBoolean()
  photo?: boolean;

  @IsOptional()
  @IsBoolean()
  className?: boolean;

  @IsOptional()
  @IsBoolean()
  classOrDepartment?: boolean;

  @IsOptional()
  @IsBoolean()
  division?: boolean;

  @IsOptional()
  @IsBoolean()
  rollNumber?: boolean;

  @IsOptional()
  @IsBoolean()
  dob?: boolean;

  @IsOptional()
  @IsBoolean()
  bloodGroup?: boolean;

  @IsOptional()
  @IsBoolean()
  parentName?: boolean;

  @IsOptional()
  @IsBoolean()
  mobileNumber?: boolean;

  @IsOptional()
  @IsBoolean()
  mobile?: boolean;

  @IsOptional()
  @IsBoolean()
  emergencyNumber?: boolean;

  @IsOptional()
  @IsBoolean()
  fullAddress?: boolean;

  @IsOptional()
  @IsBoolean()
  address?: boolean;

  @IsOptional()
  @IsBoolean()
  aadhaarNumber?: boolean;

  @IsOptional()
  @IsBoolean()
  rfidRequired?: boolean;
}

export class CreateIntakeCampaignSubmissionModelDto {
  @IsString()
  mode!: string;

  @IsOptional()
  @IsEnum(IntakeActorType)
  actorType?: IntakeActorType;

  @IsOptional()
  @IsBoolean()
  requirePhotoStandardization?: boolean;

  @IsOptional()
  @IsBoolean()
  requireParentOtp?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  distributionChannels?: string[];

  @IsOptional()
  @IsBoolean()
  bulkUploadEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  intakeLinkOptional?: boolean;

  @IsOptional()
  @IsBoolean()
  workflowRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  allowMobileEditAfterVerification?: boolean;

  @IsOptional()
  @IsIn(["ONE_PER_CAMPAIGN", "ONE_PER_STUDENT", "ALLOW_MULTIPLE"])
  duplicatePolicy?: "ONE_PER_CAMPAIGN" | "ONE_PER_STUDENT" | "ALLOW_MULTIPLE";
}

export class CreateIntakeCampaignApprovalRulesDto {
  @IsOptional()
  @IsBoolean()
  approvalRequired?: boolean;
}

export class CreateIntakeCampaignDto {
  @IsString()
  campaignName!: string;

  @IsOptional()
  @IsEnum(InstitutionType)
  institutionType?: InstitutionType;

  @IsOptional()
  @IsEnum(IntakeAudience)
  audience?: IntakeAudience;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateIntakeCampaignSegmentDto)
  targetSegments!: CreateIntakeCampaignSegmentDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  maxExpectedVolume?: number;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateIntakeCampaignDataSchemaDto)
  dataSchema?: CreateIntakeCampaignDataSchemaDto;

  @ValidateNested()
  @Type(() => CreateIntakeCampaignSubmissionModelDto)
  submissionModel!: CreateIntakeCampaignSubmissionModelDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateIntakeCampaignApprovalRulesDto)
  approvalRules?: CreateIntakeCampaignApprovalRulesDto;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxStudentsPerParent?: number;

  @IsOptional()
  @IsString()
  photoBgPreference?: string;

  @IsOptional()
  @IsBoolean()
  allowSiblings?: boolean;

  @IsOptional()
  @IsBoolean()
  allowDraftSave?: boolean;

  @IsOptional()
  @IsBoolean()
  photoCaptureRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  allowPhotoUpload?: boolean;

  @IsOptional()
  @IsBoolean()
  paymentRequired?: boolean;

  @IsOptional()
  @IsString()
  approvalOwnerId?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsObject()
  metadataJson?: Record<string, unknown>;
}
