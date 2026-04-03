import { IsOptional, IsString, MinLength } from "class-validator";

export class AnalyzePhotoDto {
  @IsString()
  @MinLength(4)
  intakeToken!: string;

  @IsOptional()
  @IsString()
  photoDataUrl?: string;

  @IsOptional()
  @IsString()
  photoKey?: string;
}
