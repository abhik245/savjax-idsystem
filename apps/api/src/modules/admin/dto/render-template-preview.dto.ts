import { IsBoolean, IsIn, IsObject, IsOptional, IsString } from "class-validator";

export class RenderTemplatePreviewDto {
  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsIn(["front", "back", "both"])
  side?: "front" | "back" | "both";

  @IsOptional()
  @IsBoolean()
  includeWarnings?: boolean;

  @IsOptional()
  @IsObject()
  overrideFields?: Record<string, unknown>;
}
