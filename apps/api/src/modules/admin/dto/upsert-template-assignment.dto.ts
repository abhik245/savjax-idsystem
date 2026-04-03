import { InstitutionType, TemplateAssignmentScope, TemplateCardType } from "@prisma/client";
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class UpsertTemplateAssignmentDto {
  @IsString()
  templateId!: string;

  @IsEnum(TemplateAssignmentScope)
  scope!: TemplateAssignmentScope;

  @IsOptional()
  @IsEnum(InstitutionType)
  institutionType?: InstitutionType;

  @IsOptional()
  @IsString()
  intakeLinkId?: string;

  @IsOptional()
  @IsString()
  className?: string;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsEnum(TemplateCardType)
  cardType?: TemplateCardType;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9999)
  priority?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
