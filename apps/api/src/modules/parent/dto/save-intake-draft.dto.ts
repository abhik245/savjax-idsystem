import { IsOptional, IsString, Matches } from "class-validator";

export class SaveIntakeDraftDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  parentName?: string;

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
}
