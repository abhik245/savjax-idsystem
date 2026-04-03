import { IsOptional, IsString } from "class-validator";

export class ValidateStudentDto {
  @IsOptional()
  @IsString()
  note?: string;
}
