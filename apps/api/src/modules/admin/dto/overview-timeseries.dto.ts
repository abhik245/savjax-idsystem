import { IsIn, IsOptional } from "class-validator";
import { OverviewFilterDto } from "./overview-filter.dto";

export class OverviewTimeSeriesDto extends OverviewFilterDto {
  @IsOptional()
  @IsIn(["daily", "weekly"])
  granularity?: "daily" | "weekly";

  @IsIn(["submissions", "approvals", "revenue"])
  metric!: "submissions" | "approvals" | "revenue";
}

