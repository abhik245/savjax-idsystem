import { TemplateLifecycleStatus } from "@prisma/client";
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString } from "class-validator";

export class UpdateTemplateMappingDto {
  @IsOptional()
  @IsObject()
  mappingJson?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  frontDesignUrl?: string;

  @IsOptional()
  @IsString()
  backDesignUrl?: string;

  @IsOptional()
  @IsObject()
  frontLayoutJson?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  backLayoutJson?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(TemplateLifecycleStatus)
  status?: TemplateLifecycleStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  lockApprovedProofs?: boolean;
}
