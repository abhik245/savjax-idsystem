import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class MergeDuplicateDto {
  @IsString()
  targetStudentId!: string;

  @IsString()
  @MinLength(3)
  reason!: string;

  @IsOptional()
  @IsBoolean()
  preferSourcePhoto?: boolean;
}
