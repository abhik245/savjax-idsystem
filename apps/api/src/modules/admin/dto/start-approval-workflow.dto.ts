import { IsBoolean, IsObject, IsOptional, IsString, MaxLength } from "class-validator";

export class StartApprovalWorkflowDto {
  @IsOptional()
  @IsString()
  chainId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsBoolean()
  forceRestart?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
