import { IsDateString, IsIn, IsOptional, IsString } from "class-validator";

export class OverviewFilterDto {
  @IsOptional()
  @IsDateString()
  start?: string;

  @IsOptional()
  @IsDateString()
  end?: string;

  @IsOptional()
  @IsString()
  salesOwnerId?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsIn(["ACTIVE", "INACTIVE"])
  status?: "ACTIVE" | "INACTIVE";
}
