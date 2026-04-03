import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";
import { AuthenticatedUser } from "../../common/auth/auth-user.type";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../common/enums/role.enum";

@Controller("dashboard")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  Role.SUPER_ADMIN,
  Role.COMPANY_ADMIN,
  Role.OPERATIONS_ADMIN,
  Role.SALES_PERSON,
  Role.SALES,
  Role.PRINTING,
  Role.SCHOOL_ADMIN,
  Role.SCHOOL_STAFF
)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("summary")
  summary(@Req() req: { user: AuthenticatedUser }) {
    return this.dashboardService.summary(req.user);
  }
}
