import { InstitutionType } from "@prisma/client";
import { IsEmail, IsEnum, IsIn, IsObject, IsOptional, IsString, MinLength } from "class-validator";

export class CreateSchoolDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  principalName?: string;

  @IsOptional()
  @IsEmail()
  principalEmail?: string;

  @IsOptional()
  @IsString()
  principalPhone?: string;

  @IsOptional()
  @IsString()
  salesOwnerId?: string;

  @IsOptional()
  @IsEnum(InstitutionType)
  institutionType?: InstitutionType;

  @IsOptional()
  @IsIn(["ACTIVE", "INACTIVE"])
  status?: "ACTIVE" | "INACTIVE";

  @IsOptional()
  @IsEmail()
  adminEmail?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  adminPassword?: string;

  @IsOptional()
  @IsObject()
  registrationData?: Record<string, unknown>;
}
