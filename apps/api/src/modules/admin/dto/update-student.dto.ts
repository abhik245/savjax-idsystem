import { IsIn, IsOptional, IsString } from "class-validator";

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  parentName?: string;

  @IsOptional()
  @IsString()
  className?: string;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  rollNumber?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsIn([
    "DRAFT",
    "SUBMITTED",
    "SCHOOL_APPROVED",
    "SALES_APPROVED",
    "IN_PRINT_QUEUE",
    "PRINTED",
    "DELIVERED",
    "REJECTED"
  ])
  status?:
    | "DRAFT"
    | "SUBMITTED"
    | "SCHOOL_APPROVED"
    | "SALES_APPROVED"
    | "IN_PRINT_QUEUE"
    | "PRINTED"
    | "DELIVERED"
    | "REJECTED";
}

