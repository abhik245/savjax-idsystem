import { IsEmail, IsIn, IsOptional, IsString } from "class-validator";

export class UpdateSchoolDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

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
  @IsIn(["ACTIVE", "INACTIVE"])
  status?: "ACTIVE" | "INACTIVE";
}
