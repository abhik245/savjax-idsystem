import { StudentStatus } from "@prisma/client";
import { IsArray, IsBoolean, IsEnum, IsIn, IsOptional, IsString } from "class-validator";

export class CreateRenderBatchDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  studentIds?: string[];

  @IsOptional()
  @IsString()
  intakeLinkId?: string;

  @IsOptional()
  @IsString()
  className?: string;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsEnum(StudentStatus)
  studentStatus?: StudentStatus;

  @IsOptional()
  @IsBoolean()
  onlyApproved?: boolean;

  @IsOptional()
  @IsBoolean()
  skipInvalid?: boolean;

  @IsOptional()
  @IsIn(["PDF", "JSON"])
  outputFormat?: "PDF" | "JSON";

  @IsOptional()
  @IsIn(["A4", "A3", "CUSTOM"])
  pageSize?: "A4" | "A3" | "CUSTOM";

  @IsOptional()
  @IsString()
  customPageMm?: string;

  @IsOptional()
  @IsString()
  grid?: string;

  @IsOptional()
  @IsIn(["FRONT_ONLY", "BACK_ONLY", "FRONT_BACK"])
  sideMode?: "FRONT_ONLY" | "BACK_ONLY" | "FRONT_BACK";
}
