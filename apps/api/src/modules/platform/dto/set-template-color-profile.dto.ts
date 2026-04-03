import { IsBoolean, IsOptional, IsString } from "class-validator";

export class SetTemplateColorProfileDto {
  @IsString()
  templateId!: string;

  @IsOptional()
  @IsString()
  colorProfile?: string;

  @IsOptional()
  @IsBoolean()
  softProofEnabled?: boolean;

  @IsOptional()
  @IsString()
  warningTolerance?: string;
}
