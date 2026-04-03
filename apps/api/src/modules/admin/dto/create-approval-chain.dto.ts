import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";
import { InstitutionType } from "@prisma/client";
import { Role } from "../../../common/enums/role.enum";

class CreateApprovalChainStepDto {
  @IsEnum(Role)
  role!: Role;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @IsBoolean()
  isOptional?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  slaHours?: number;
}

export class CreateApprovalChainDto {
  @IsEnum(InstitutionType)
  institutionType!: InstitutionType;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => CreateApprovalChainStepDto)
  steps!: CreateApprovalChainStepDto[];
}

export type CreateApprovalChainStepInput = CreateApprovalChainStepDto;
