import { IntakeSubmissionStage, StudentStatus } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";

export class ApplyCorrectionDto {
  @IsString()
  @MinLength(3)
  reason!: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  parentName?: string;

  @IsOptional()
  @IsString()
  className?: string;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  rollNumber?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  photoKey?: string;

  @IsOptional()
  @IsEnum(IntakeSubmissionStage)
  intakeStage?: IntakeSubmissionStage;

  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;
}
