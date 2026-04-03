import { IsInt, IsOptional, Max, Min } from "class-validator";

export class RetentionSummaryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  otpRetentionHours?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  resetTokenRetentionHours?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  sessionRetentionDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  artifactRetentionDays?: number;
}
