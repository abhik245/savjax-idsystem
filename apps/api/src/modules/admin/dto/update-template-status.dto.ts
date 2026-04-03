import { TemplateLifecycleStatus } from "@prisma/client";
import { IsBoolean, IsEnum, IsOptional, IsString } from "class-validator";

export class UpdateTemplateStatusDto {
  @IsEnum(TemplateLifecycleStatus)
  status!: TemplateLifecycleStatus;

  @IsOptional()
  @IsBoolean()
  deactivateOthers?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
