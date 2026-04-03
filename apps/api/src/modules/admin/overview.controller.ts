import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../common/enums/role.enum";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { OverviewDrilldownDto } from "./dto/overview-drilldown.dto";
import { OverviewFilterDto } from "./dto/overview-filter.dto";
import { OverviewSalesPerformanceDto } from "./dto/overview-sales-performance.dto";
import { OverviewTimeSeriesDto } from "./dto/overview-timeseries.dto";
import { OverviewService } from "./overview.service";

type AuthRequest = { user: { sub: string; role: Role; schoolId?: string } };

@Controller("admin/overview")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class OverviewController {
  constructor(private readonly overviewService: OverviewService) {}

  @Get("kpis")
  getKpis(@Req() req: AuthRequest, @Query() query: OverviewFilterDto) {
    return this.overviewService.getKpis(req.user, query);
  }

  @Get("timeseries")
  getTimeSeries(@Req() req: AuthRequest, @Query() query: OverviewTimeSeriesDto) {
    return this.overviewService.getTimeSeries(req.user, query);
  }

  @Get("sales-performance")
  getSalesPerformance(@Req() req: AuthRequest, @Query() query: OverviewSalesPerformanceDto) {
    return this.overviewService.getSalesPerformance(req.user, query);
  }

  @Get("drilldown")
  getDrilldown(@Req() req: AuthRequest, @Query() query: OverviewDrilldownDto) {
    return this.overviewService.getDrilldown(req.user, query);
  }
}

