import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class GenerateDigitalIdDto {
  @IsString()
  studentId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2400)
  ttlHours?: number;
}
