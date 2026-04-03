import { ApprovalActionType } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class ApprovalWorkflowActionDto {
  @IsEnum(ApprovalActionType)
  action!: ApprovalActionType;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
