import { IsDateString, IsIn, IsOptional, IsString } from "class-validator";

export class OverviewDrilldownDto {
  @IsIn(["submissions", "approvals", "pending_approvals", "revenue"])
  metric!: "submissions" | "approvals" | "pending_approvals" | "revenue";

  @IsDateString()
  date!: string;

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
