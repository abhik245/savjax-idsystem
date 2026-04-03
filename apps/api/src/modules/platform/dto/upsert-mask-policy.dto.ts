import { IsArray, IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class UpsertMaskPolicyDto {
  @IsString()
  schoolId!: string;

  @IsString()
  @MaxLength(120)
  fieldKey!: string;

  @IsArray()
  @IsString({ each: true })
  rolesAllowed!: string[];

  @IsOptional()
  @IsString()
  maskStrategy?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
