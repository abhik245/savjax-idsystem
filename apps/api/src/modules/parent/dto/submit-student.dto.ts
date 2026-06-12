import { IsOptional, IsString, Matches, MinLength } from "class-validator";

export class SubmitStudentDto {
  @IsString()
  intakeToken!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  parentName?: string;

  @IsOptional()
  @Matches(/^\d{10}$/)
  parentMobile?: string;

  @IsOptional()
  @Matches(/^\d{10}$/)
  mobile?: string;

  @IsOptional()
  @IsString()
  className?: string;

  @IsOptional()
  @IsString()
  division?: string;

  @IsOptional()
  @IsString()
  rollNumber?: string;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  dob?: string;

  @IsOptional()
  @IsString()
  bloodGroup?: string;

  @IsOptional()
  @Matches(/^\d{10}$/)
  emergencyNumber?: string;

  @IsOptional()
  @IsString()
  aadhaarNumber?: string;

  @IsOptional()
  @IsString()
  segmentPrimaryValue?: string;

  @IsOptional()
  @IsString()
  segmentSecondaryValue?: string;

  // Staff-specific fields
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  education?: string;

  @IsOptional()
  @IsString()
  joiningDate?: string;

  @IsOptional()
  @IsString()
  photoKey?: string;

  @IsOptional()
  @IsString()
  photoDataUrl?: string;

  @IsOptional()
  @IsString()
  photoAnalysisId?: string;

  @IsOptional()
  @IsString()
  preferredPhotoName?: string;
}
