import { IsOptional, IsString, MinLength } from "class-validator";

export class ReplaceStudentPhotoDto {
  @IsString()
  @MinLength(3)
  reason!: string;

  @IsOptional()
  @IsString()
  photoDataUrl?: string;

  @IsOptional()
  @IsString()
  photoKey?: string;
}
