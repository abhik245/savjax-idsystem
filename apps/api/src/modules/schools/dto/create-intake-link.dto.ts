import { IsBoolean, IsDateString, IsEnum, IsInt, IsObject, IsOptional, IsString, Min } from "class-validator";
import { InstitutionType, IntakeAudience } from "@prisma/client";

export class CreateIntakeLinkDto {
  @IsOptional()
  @IsString()
  campaignName?: string;

  @IsOptional()
  @IsEnum(InstitutionType)
  institutionType?: InstitutionType;

  @IsOptional()
  @IsEnum(IntakeAudience)
  audience?: IntakeAudience;

  @IsOptional()
  @IsString()
  className?: string;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxStudentsPerParent?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

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
  formSchema?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadataJson?: Record<string, unknown>;
}
