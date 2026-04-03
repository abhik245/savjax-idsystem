import { AsyncJobType } from "@prisma/client";
import { IsEnum, IsObject, IsOptional, IsString } from "class-validator";

export class CreateAsyncJobDto {
  @IsOptional()
  @IsString()
  schoolId?: string;

  @IsEnum(AsyncJobType)
  type!: AsyncJobType;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
