import { IsIn, IsOptional, IsPositive } from "class-validator";
import { Type } from "class-transformer";
import { OverviewFilterDto } from "./overview-filter.dto";

export class OverviewSalesPerformanceDto extends OverviewFilterDto {
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  limit?: number;

  @IsOptional()
  @IsIn(["ACTIVE", "INACTIVE"])
  status?: "ACTIVE" | "INACTIVE";
}
