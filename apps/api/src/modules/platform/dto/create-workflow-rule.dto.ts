import { IntakeSubmissionStage } from "@prisma/client";
import { IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateWorkflowRuleDto {
  @IsString()
  schoolId!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsEnum(IntakeSubmissionStage)
  triggerStage!: IntakeSubmissionStage;

  @IsString()
  actionType!: string;

  @IsOptional()
  @IsObject()
  condition?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  actionConfig?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number;
}
