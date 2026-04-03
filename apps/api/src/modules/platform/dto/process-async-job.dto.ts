import { IsBoolean, IsOptional } from "class-validator";

export class ProcessAsyncJobDto {
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
