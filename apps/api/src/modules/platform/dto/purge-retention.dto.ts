import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, Max, Min } from "class-validator";

export class PurgeRetentionDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  otpRetentionHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  resetTokenRetentionHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  sessionRetentionDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  artifactRetentionDays?: number;
}
