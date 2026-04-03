import { IntakeSubmissionStage } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class HandoffStudentDto {
  @IsEnum(IntakeSubmissionStage)
  toStage!: IntakeSubmissionStage;

  @IsOptional()
  @IsString()
  note?: string;
}
