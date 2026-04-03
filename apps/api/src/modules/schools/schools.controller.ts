import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { SchoolsService } from "./schools.service";
import { AuthenticatedUser } from "../../common/auth/auth-user.type";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantScopeGuard } from "../../common/guards/tenant-scope.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { TenantScope } from "../../common/decorators/tenant-scope.decorator";
import { Role } from "../../common/enums/role.enum";
import { CreateSchoolDto } from "./dto/create-school.dto";
import { CreateIntakeLinkDto } from "./dto/create-intake-link.dto";

@Controller()
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES)
  @Post("schools")
  createSchool(@Body() dto: CreateSchoolDto, @Req() req: { user: AuthenticatedUser }) {
    return this.schoolsService.createSchool(dto, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    Role.SUPER_ADMIN,
    Role.COMPANY_ADMIN,
    Role.OPERATIONS_ADMIN,
    Role.SALES_PERSON,
    Role.SALES,
    Role.SCHOOL_ADMIN,
    Role.SCHOOL_STAFF
  )
  @Get("schools")
  listSchools(@Query("q") q: string | undefined, @Req() req: { user: AuthenticatedUser }) {
    return this.schoolsService.listSchools(q, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, TenantScopeGuard)
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN)
  @TenantScope({ sources: [{ type: "param", key: "schoolId" }] })
  @Post("schools/:schoolId/intake-links")
  createLink(
    @Param("schoolId") schoolId: string,
    @Body() dto: CreateIntakeLinkDto,
    @Req() req: { user: AuthenticatedUser }
  ) {
    return this.schoolsService.createIntakeLink(schoolId, dto, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, TenantScopeGuard)
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN)
  @TenantScope({ sources: [{ type: "query", key: "schoolId" }], optional: true })
  @Get("intake-links")
  listLinks(@Query("schoolId") schoolId: string | undefined, @Req() req: { user: AuthenticatedUser }) {
    return this.schoolsService.listIntakeLinks(req.user, schoolId);
  }

  @Get("intake-links/token/:token")
  getByToken(
    @Param("token") token: string,
    @Req() req: { ip?: string; headers: Record<string, string | string[] | undefined> }
  ) {
    return this.schoolsService.getIntakeLinkByToken(token, {
      ip: req.ip,
      userAgent: Array.isArray(req.headers["user-agent"]) ? req.headers["user-agent"][0] : req.headers["user-agent"]
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard, TenantScopeGuard)
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN)
  @TenantScope({ sources: [{ type: "param", key: "schoolId" }] })
  @Post("schools/:schoolId/campaigns")
  createCampaign(
    @Param("schoolId") schoolId: string,
    @Body() dto: CreateIntakeLinkDto,
    @Req() req: { user: AuthenticatedUser }
  ) {
    return this.schoolsService.createIntakeLink(schoolId, dto, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, TenantScopeGuard)
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN)
  @TenantScope({ sources: [{ type: "query", key: "schoolId" }], optional: true })
  @Get("campaigns")
  listCampaigns(@Query("schoolId") schoolId: string | undefined, @Req() req: { user: AuthenticatedUser }) {
    return this.schoolsService.listIntakeLinks(req.user, schoolId);
  }

  @Get("campaigns/token/:token")
  getCampaignByToken(
    @Param("token") token: string,
    @Req() req: { ip?: string; headers: Record<string, string | string[] | undefined> }
  ) {
    return this.schoolsService.getIntakeLinkByToken(token, {
      ip: req.ip,
      userAgent: Array.isArray(req.headers["user-agent"]) ? req.headers["user-agent"][0] : req.headers["user-agent"]
    });
  }
}
