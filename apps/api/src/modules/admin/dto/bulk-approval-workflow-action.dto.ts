import { Type } from "class-transformer";
import { ApprovalActionType } from "@prisma/client";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";

export class BulkApprovalWorkflowActionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  workflowIds!: string[];

  @IsEnum(ApprovalActionType)
  action!: ApprovalActionType;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  continueOnError?: boolean;
}
