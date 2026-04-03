import { IsIn, IsOptional, IsString } from "class-validator";

export class GeneratePrintArtifactDto {
  @IsOptional()
  @IsIn(["CSV", "JSON", "PDF"])
  format?: "CSV" | "JSON" | "PDF";

  @IsOptional()
  @IsString()
  timezone?: string;

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
