import { IsOptional, IsString, Matches, MinLength } from "class-validator";

export class SubmitStudentDto {
  @IsString()
  intakeToken!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsString()
  @MinLength(2)
  parentName!: string;

  @Matches(/^\d{10}$/)
  parentMobile!: string;

  @IsString()
  className!: string;

  @IsString()
  section!: string;

  @IsString()
  rollNumber!: string;

  @IsString()
  address!: string;

  @IsOptional()
  @IsString()
  photoKey?: string;

  @IsOptional()
  @IsString()
  photoDataUrl?: string;

  @IsOptional()
  @IsString()
  photoAnalysisId?: string;
}
