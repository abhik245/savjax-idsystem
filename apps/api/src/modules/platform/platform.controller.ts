import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Query,
  Res,
  Req,
  UseGuards
} from "@nestjs/common";
import { AsyncJobStatus, AsyncJobType } from "@prisma/client";
import type { Response } from "express";
import { AuthenticatedUser } from "../../common/auth/auth-user.type";
import { Roles } from "../../common/decorators/roles.decorator";
import { TenantScope } from "../../common/decorators/tenant-scope.decorator";
import { Role } from "../../common/enums/role.enum";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantScopeGuard } from "../../common/guards/tenant-scope.guard";
import { ApplyWorkflowRuleDto } from "./dto/apply-workflow-rule.dto";
import { CreateAsyncJobDto } from "./dto/create-async-job.dto";
import { CreateWorkflowRuleDto } from "./dto/create-workflow-rule.dto";
import { GenerateDigitalIdDto } from "./dto/generate-digital-id.dto";
import { ProcessAsyncJobDto } from "./dto/process-async-job.dto";
import { RevokeUserSessionsDto } from "./dto/revoke-user-sessions.dto";
import { ScanDigitalIdDto } from "./dto/scan-digital-id.dto";
import { SetTemplateColorProfileDto } from "./dto/set-template-color-profile.dto";
import { UpdateWorkflowRuleDto } from "./dto/update-workflow-rule.dto";
import { UpsertMaskPolicyDto } from "./dto/upsert-mask-policy.dto";
import { RetentionSummaryDto } from "./dto/retention-summary.dto";
import { PurgeRetentionDto } from "./dto/purge-retention.dto";
import { PlatformService } from "./platform.service";

type AuthRequest = { user: AuthenticatedUser };
const GeneratedArtifactEntityType = {
  PRINT_JOB: "PRINT_JOB",
  RENDER_BATCH: "RENDER_BATCH"
} as const;
type GeneratedArtifactEntityTypeValue =
  (typeof GeneratedArtifactEntityType)[keyof typeof GeneratedArtifactEntityType];

@Controller("platform")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get("security/mask-policies")
  @UseGuards(TenantScopeGuard)
  @TenantScope({ sources: [{ type: "query", key: "schoolId" }], optional: true })
  @Roles(
    Role.SUPER_ADMIN,
    Role.COMPANY_ADMIN,
    Role.OPERATIONS_ADMIN,
    Role.HR_ADMIN,
    Role.SALES_PERSON,
    Role.SALES,
    Role.SCHOOL_ADMIN
  )
  listMaskPolicies(@Req() req: AuthRequest, @Query("schoolId") schoolId?: string) {
    return this.platformService.listMaskPolicies(req.user, schoolId);
  }

  @Post("security/mask-policies")
  @UseGuards(TenantScopeGuard)
  @TenantScope({ sources: [{ type: "body", key: "schoolId" }] })
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.HR_ADMIN)
  upsertMaskPolicy(@Req() req: AuthRequest, @Body() dto: UpsertMaskPolicyDto) {
    return this.platformService.upsertMaskPolicy(req.user, dto);
  }

  @Get("security/assets/signed-url")
  @Roles(
    Role.SUPER_ADMIN,
    Role.COMPANY_ADMIN,
    Role.OPERATIONS_ADMIN,
    Role.SALES_PERSON,
    Role.SALES,
    Role.SCHOOL_ADMIN,
    Role.SCHOOL_STAFF,
    Role.PRINTING,
    Role.PRINT_OPS
  )
  getSignedAssetUrl(
    @Req() req: AuthRequest,
    @Query("photoKey") photoKey: string,
    @Query("ttlSeconds") ttlSeconds?: string
  ) {
    return this.platformService.getSignedAssetUrl(req.user, photoKey, ttlSeconds ? Number(ttlSeconds) : undefined);
  }

  @Get("security/assets/:token")
  @Roles(
    Role.SUPER_ADMIN,
    Role.COMPANY_ADMIN,
    Role.OPERATIONS_ADMIN,
    Role.SALES_PERSON,
    Role.SALES,
    Role.SCHOOL_ADMIN,
    Role.SCHOOL_STAFF,
    Role.PRINTING,
    Role.PRINT_OPS
  )
  resolveSignedAsset(@Req() req: AuthRequest, @Param("token") token: string, @Res() res: Response) {
    return this.platformService.resolveSignedAsset(req.user, token, res);
  }

  @Get("security/generated-artifacts/signed-url")
  @Roles(
    Role.SUPER_ADMIN,
    Role.COMPANY_ADMIN,
    Role.OPERATIONS_ADMIN,
    Role.SALES_PERSON,
    Role.SALES,
    Role.SCHOOL_ADMIN,
    Role.PRINTING,
    Role.PRINT_OPS
  )
  getSignedGeneratedArtifactUrl(
    @Req() req: AuthRequest,
    @Query("entityType", new ParseEnumPipe(GeneratedArtifactEntityType))
    entityType: GeneratedArtifactEntityTypeValue,
    @Query("entityId") entityId: string,
    @Query("ttlSeconds") ttlSeconds?: string
  ) {
    return this.platformService.getSignedGeneratedArtifactUrl(
      req.user,
      entityType,
      entityId,
      ttlSeconds ? Number(ttlSeconds) : undefined
    );
  }

  @Get("security/generated-artifacts/:token")
  @Roles(
    Role.SUPER_ADMIN,
    Role.COMPANY_ADMIN,
    Role.OPERATIONS_ADMIN,
    Role.SALES_PERSON,
    Role.SALES,
    Role.SCHOOL_ADMIN,
    Role.PRINTING,
    Role.PRINT_OPS
  )
  downloadGeneratedArtifact(@Req() req: AuthRequest, @Param("token") token: string, @Res() res: Response) {
    return this.platformService.downloadGeneratedArtifact(req.user, token, res);
  }

  @Get("security/auth-anomalies")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.HR_ADMIN)
  listAuthAnomalies(@Req() req: AuthRequest, @Query("limit") limit?: string) {
    return this.platformService.listAuthAnomalies(req.user, limit ? Number(limit) : undefined);
  }

  @Get("security/event-feed")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.HR_ADMIN)
  listSecurityEventFeed(@Req() req: AuthRequest, @Query("limit") limit?: string) {
    return this.platformService.listSecurityEvents(req.user, limit ? Number(limit) : undefined);
  }

  @Post("security/revoke-sessions")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.HR_ADMIN)
  revokeUserSessions(@Req() req: AuthRequest, @Body() dto: RevokeUserSessionsDto) {
    return this.platformService.revokeUserSessions(req.user, dto);
  }

  @Get("security/retention/summary")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.HR_ADMIN)
  retentionSummary(@Req() req: AuthRequest, @Query() query: RetentionSummaryDto) {
    return this.platformService.getRetentionSummary(req.user, query);
  }

  @Post("security/retention/purge")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN)
  purgeRetention(@Req() req: AuthRequest, @Body() dto: PurgeRetentionDto) {
    return this.platformService.purgeRetentionArtifacts(req.user, dto);
  }

  @Post("async-jobs")
  @UseGuards(TenantScopeGuard)
  @TenantScope({ sources: [{ type: "body", key: "schoolId" }], optional: true })
  @Roles(
    Role.SUPER_ADMIN,
    Role.COMPANY_ADMIN,
    Role.OPERATIONS_ADMIN,
    Role.SALES_PERSON,
    Role.SALES,
    Role.SCHOOL_ADMIN,
    Role.PRINTING,
    Role.PRINT_OPS
  )
  createAsyncJob(@Req() req: AuthRequest, @Body() dto: CreateAsyncJobDto) {
    return this.platformService.createAsyncJob(req.user, dto);
  }

  @Get("async-jobs")
  @UseGuards(TenantScopeGuard)
  @TenantScope({ sources: [{ type: "query", key: "schoolId" }], optional: true })
  @Roles(
    Role.SUPER_ADMIN,
    Role.COMPANY_ADMIN,
    Role.OPERATIONS_ADMIN,
    Role.SALES_PERSON,
    Role.SALES,
    Role.SCHOOL_ADMIN,
    Role.PRINTING,
    Role.PRINT_OPS
  )
  listAsyncJobs(
    @Req() req: AuthRequest,
    @Query("schoolId") schoolId?: string,
    @Query("status", new ParseEnumPipe(AsyncJobStatus, { optional: true })) status?: AsyncJobStatus,
    @Query("type", new ParseEnumPipe(AsyncJobType, { optional: true })) type?: AsyncJobType
  ) {
    return this.platformService.listAsyncJobs(req.user, schoolId, status, type);
  }

  @Post("async-jobs/:jobId/process")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.HR_ADMIN)
  processAsyncJob(
    @Req() req: AuthRequest,
    @Param("jobId") jobId: string,
    @Body() dto: ProcessAsyncJobDto
  ) {
    return this.platformService.processAsyncJob(req.user, jobId, dto);
  }

  @Get("reports/enterprise")
  @UseGuards(TenantScopeGuard)
  @TenantScope({ sources: [{ type: "query", key: "schoolId" }], optional: true })
  @Roles(
    Role.SUPER_ADMIN,
    Role.COMPANY_ADMIN,
    Role.OPERATIONS_ADMIN,
    Role.SALES_PERSON,
    Role.SALES,
    Role.SCHOOL_ADMIN,
    Role.FINANCE
  )
  enterpriseReport(
    @Req() req: AuthRequest,
    @Query("start") start?: string,
    @Query("end") end?: string,
    @Query("institutionType") institutionType?: string,
    @Query("region") region?: string,
    @Query("schoolId") schoolId?: string
  ) {
    return this.platformService.enterpriseReport(req.user, { start, end, institutionType, region, schoolId });
  }

  @Post("digital-id/generate")
  @Roles(
    Role.SUPER_ADMIN,
    Role.COMPANY_ADMIN,
    Role.OPERATIONS_ADMIN,
    Role.SALES_PERSON,
    Role.SALES,
    Role.SCHOOL_ADMIN,
    Role.SCHOOL_STAFF,
    Role.SUPPORT
  )
  generateDigitalId(@Req() req: AuthRequest, @Body() dto: GenerateDigitalIdDto) {
    return this.platformService.generateDigitalId(req.user, dto);
  }

  @Get("digital-id/verify")
  @Roles(
    Role.SUPER_ADMIN,
    Role.COMPANY_ADMIN,
    Role.OPERATIONS_ADMIN,
    Role.SALES_PERSON,
    Role.SALES,
    Role.SCHOOL_ADMIN,
    Role.SCHOOL_STAFF,
    Role.PRINTING,
    Role.PRINT_OPS,
    Role.SUPPORT
  )
  verifyDigitalId(@Req() req: AuthRequest, @Query("token") token: string) {
    return this.platformService.verifyDigitalId(req.user, token);
  }

  @Post("digital-id/scan")
  @Roles(
    Role.SUPER_ADMIN,
    Role.COMPANY_ADMIN,
    Role.OPERATIONS_ADMIN,
    Role.SALES_PERSON,
    Role.SALES,
    Role.SCHOOL_ADMIN,
    Role.SCHOOL_STAFF,
    Role.PRINTING,
    Role.PRINT_OPS,
    Role.SUPPORT
  )
  scanDigitalId(@Req() req: AuthRequest, @Body() dto: ScanDigitalIdDto) {
    return this.platformService.scanDigitalId(req.user, dto);
  }

  @Get("workflow-rules")
  @UseGuards(TenantScopeGuard)
  @TenantScope({ sources: [{ type: "query", key: "schoolId" }], optional: true })
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN)
  listWorkflowRules(@Req() req: AuthRequest, @Query("schoolId") schoolId?: string) {
    return this.platformService.listWorkflowRules(req.user, schoolId);
  }

  @Post("workflow-rules")
  @UseGuards(TenantScopeGuard)
  @TenantScope({ sources: [{ type: "body", key: "schoolId" }] })
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN)
  createWorkflowRule(@Req() req: AuthRequest, @Body() dto: CreateWorkflowRuleDto) {
    return this.platformService.createWorkflowRule(req.user, dto);
  }

  @Patch("workflow-rules/:ruleId")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN)
  updateWorkflowRule(@Req() req: AuthRequest, @Param("ruleId") ruleId: string, @Body() dto: UpdateWorkflowRuleDto) {
    return this.platformService.updateWorkflowRule(req.user, ruleId, dto);
  }

  @Post("workflow-rules/:ruleId/apply")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN)
  applyWorkflowRule(@Req() req: AuthRequest, @Param("ruleId") ruleId: string, @Body() dto: ApplyWorkflowRuleDto) {
    return this.platformService.applyWorkflowRule(req.user, ruleId, dto);
  }

  @Post("templates/color-profile")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN)
  setTemplateColorProfile(@Req() req: AuthRequest, @Body() dto: SetTemplateColorProfileDto) {
    return this.platformService.setTemplateColorProfile(req.user, dto);
  }
}
