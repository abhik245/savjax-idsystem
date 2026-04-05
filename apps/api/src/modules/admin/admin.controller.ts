import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  ParseEnumPipe,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import {
  ApprovalWorkflowStatus,
  InstitutionType,
  IntakeSubmissionStage,
  StudentStatus,
  TemplateLifecycleStatus
} from "@prisma/client";
import { AuthenticatedUser } from "../../common/auth/auth-user.type";
import { Roles } from "../../common/decorators/roles.decorator";
import { TenantScope } from "../../common/decorators/tenant-scope.decorator";
import { Role } from "../../common/enums/role.enum";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantScopeGuard } from "../../common/guards/tenant-scope.guard";
import { AdminService } from "./admin.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { CreateSchoolUserDto } from "./dto/create-school-user.dto";
import { DispatchPrintDto } from "./dto/dispatch-print.dto";
import { UpsertSalesAssignmentDto } from "./dto/upsert-sales-assignment.dto";
import { ApplyCorrectionDto } from "./dto/apply-correction.dto";
import { CreateTemplateDto } from "./dto/create-template.dto";
import { DuplicateTemplateDto } from "./dto/duplicate-template.dto";
import { HandoffStudentDto } from "./dto/handoff-student.dto";
import { MergeDuplicateDto } from "./dto/merge-duplicate.dto";
import { ReplaceStudentPhotoDto } from "./dto/replace-student-photo.dto";
import { UpdateSchoolDto } from "./dto/update-school.dto";
import { UpdateStudentDto } from "./dto/update-student.dto";
import { UpdateTemplateMappingDto } from "./dto/update-template-mapping.dto";
import { ValidateStudentDto } from "./dto/validate-student.dto";
import { RenderTemplatePreviewDto } from "./dto/render-template-preview.dto";
import { BindTemplateCampaignDto } from "./dto/bind-template-campaign.dto";
import { RebindTemplateProofsDto } from "./dto/rebind-template-proofs.dto";
import { ActivateTemplateDto } from "./dto/activate-template.dto";
import { UpdateTemplateStatusDto } from "./dto/update-template-status.dto";
import { UpsertTemplateAssignmentDto } from "./dto/upsert-template-assignment.dto";
import { CreateRenderBatchDto } from "./dto/create-render-batch.dto";
import { ExportRenderBatchDto } from "./dto/export-render-batch.dto";
import { CreateApprovalChainDto } from "./dto/create-approval-chain.dto";
import { ActivateApprovalChainDto } from "./dto/activate-approval-chain.dto";
import { StartApprovalWorkflowDto } from "./dto/start-approval-workflow.dto";
import { ApprovalWorkflowActionDto } from "./dto/approval-workflow-action.dto";
import { BulkApprovalWorkflowActionDto } from "./dto/bulk-approval-workflow-action.dto";
import { UpdatePrintJobStatusDto } from "./dto/update-print-job-status.dto";
import { GeneratePrintArtifactDto } from "./dto/generate-print-artifact.dto";
import { RequestReissueDto } from "./dto/request-reissue.dto";
import { CreateReprintBatchDto } from "./dto/create-reprint-batch.dto";
import { MarkPrintJobIssuedDto } from "./dto/mark-print-job-issued.dto";

type AuthRequest = { user: AuthenticatedUser };

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("users")
  @Roles(
    Role.SUPER_ADMIN,
    Role.COMPANY_ADMIN,
    Role.OPERATIONS_ADMIN,
    Role.HR,
    Role.HR_ADMIN,
    Role.SCHOOL_ADMIN,
    Role.SALES_PERSON,
    Role.SALES,
    Role.PRINTING
  )
  listUsers(
    @Req() req: AuthRequest,
    @Query("q") q?: string,
    @Query("role", new ParseEnumPipe(Role, { optional: true })) role?: Role
  ) {
    return this.adminService.listUsers(req.user, q, role);
  }

  @Post("users")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.HR, Role.HR_ADMIN)
  createUser(@Req() req: AuthRequest, @Body() dto: CreateUserDto) {
    return this.adminService.createUser(req.user, dto);
  }

  @Delete("users/:userId")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN)
  deleteUser(@Req() req: AuthRequest, @Param("userId") userId: string) {
    return this.adminService.deleteUser(req.user, userId);
  }

  @Post("schools/:schoolId/users")
  @UseGuards(TenantScopeGuard)
  @TenantScope({ sources: [{ type: "param", key: "schoolId" }] })
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SCHOOL_ADMIN)
  createSchoolUser(
    @Req() req: AuthRequest,
    @Param("schoolId") schoolId: string,
    @Body() dto: CreateSchoolUserDto
  ) {
    return this.adminService.createSchoolUser(req.user, schoolId, dto);
  }

  @Get("sales-assignments")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN)
  listSalesAssignments(@Req() req: AuthRequest, @Query("schoolId") schoolId?: string) {
    return this.adminService.listSalesAssignments(req.user, schoolId);
  }

  @Post("sales-assignments")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN)
  upsertSalesAssignment(@Req() req: AuthRequest, @Body() dto: UpsertSalesAssignmentDto) {
    return this.adminService.upsertSalesAssignment(req.user, dto);
  }

  @Delete("sales-assignments/:assignmentId")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN)
  deleteSalesAssignment(@Req() req: AuthRequest, @Param("assignmentId") assignmentId: string) {
    return this.adminService.deleteSalesAssignment(req.user, assignmentId);
  }

  @Get("schools/:schoolId/detail")
  @UseGuards(TenantScopeGuard)
  @TenantScope({ sources: [{ type: "param", key: "schoolId" }] })
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
  getSchoolDetail(@Req() req: AuthRequest, @Param("schoolId") schoolId: string) {
    return this.adminService.getSchoolDetail(req.user, schoolId);
  }

  @Get("schools/:schoolId/students")
  @UseGuards(TenantScopeGuard)
  @TenantScope({ sources: [{ type: "param", key: "schoolId" }] })
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
  listSchoolStudents(
    @Req() req: AuthRequest,
    @Param("schoolId") schoolId: string,
    @Query("q") q?: string,
    @Query("status", new ParseEnumPipe(StudentStatus, { optional: true })) status?: StudentStatus,
    @Query("className") className?: string,
    @Query("page") page?: number,
    @Query("pageSize") pageSize?: number
  ) {
    return this.adminService.listSchoolStudents(req.user, schoolId, { q, status, className, page, pageSize });
  }

  @Get("schools/:schoolId/students/export")
  @UseGuards(TenantScopeGuard)
  @TenantScope({ sources: [{ type: "param", key: "schoolId" }] })
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
  exportSchoolStudents(
    @Req() req: AuthRequest,
    @Param("schoolId") schoolId: string,
    @Query("q") q?: string,
    @Query("status", new ParseEnumPipe(StudentStatus, { optional: true })) status?: StudentStatus,
    @Query("className") className?: string
  ) {
    return this.adminService.exportSchoolStudents(req.user, schoolId, { q, status, className });
  }

  @Get("schools/:schoolId/classes")
  @UseGuards(TenantScopeGuard)
  @TenantScope({ sources: [{ type: "param", key: "schoolId" }] })
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
  listSchoolClassSummary(@Req() req: AuthRequest, @Param("schoolId") schoolId: string) {
    return this.adminService.listSchoolClassSummary(req.user, schoolId);
  }

  @Get("schools/:schoolId/audit-logs")
  @UseGuards(TenantScopeGuard)
  @TenantScope({ sources: [{ type: "param", key: "schoolId" }] })
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN)
  listSchoolAuditLogs(
    @Req() req: AuthRequest,
    @Param("schoolId") schoolId: string,
    @Query("entityType") entityType?: string,
    @Query("page") page?: number,
    @Query("pageSize") pageSize?: number
  ) {
    return this.adminService.listSchoolAuditLogs(req.user, schoolId, { entityType, page, pageSize });
  }

  @Get("reports/schools")
  @UseGuards(TenantScopeGuard)
  @TenantScope({ sources: [{ type: "query", key: "schoolId" }], optional: true })
  @Roles(
    Role.SUPER_ADMIN,
    Role.COMPANY_ADMIN,
    Role.OPERATIONS_ADMIN,
    Role.SALES_PERSON,
    Role.SALES,
    Role.SCHOOL_ADMIN,
    Role.SCHOOL_STAFF
  )
  buildSchoolReport(
    @Req() req: AuthRequest,
    @Query("schoolId") schoolId?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("status", new ParseEnumPipe(StudentStatus, { optional: true })) status?: StudentStatus
  ) {
    return this.adminService.buildSchoolReport(req.user, { schoolId, dateFrom, dateTo, status });
  }

  @Get("reports/schools.csv")
  @UseGuards(TenantScopeGuard)
  @TenantScope({ sources: [{ type: "query", key: "schoolId" }], optional: true })
  @Roles(
    Role.SUPER_ADMIN,
    Role.COMPANY_ADMIN,
    Role.OPERATIONS_ADMIN,
    Role.SALES_PERSON,
    Role.SALES,
    Role.SCHOOL_ADMIN
  )
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", "attachment; filename=school-report.csv")
  exportSchoolReportCsv(
    @Req() req: AuthRequest,
    @Query("schoolId") schoolId?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("status", new ParseEnumPipe(StudentStatus, { optional: true })) status?: StudentStatus
  ) {
    return this.adminService.exportSchoolReportCsv(req.user, { schoolId, dateFrom, dateTo, status });
  }

  @Post("print-jobs/dispatch")
  @Roles(
    Role.SUPER_ADMIN,
    Role.COMPANY_ADMIN,
    Role.OPERATIONS_ADMIN,
    Role.SALES_PERSON,
    Role.SALES,
    Role.PRINTING,
    Role.SCHOOL_ADMIN
  )
  dispatchToPrint(@Req() req: AuthRequest, @Body() dto: DispatchPrintDto) {
    return this.adminService.dispatchToPrint(req.user, dto);
  }

  @Post("print-jobs/reprint")
  @Roles(
    Role.SUPER_ADMIN,
    Role.COMPANY_ADMIN,
    Role.OPERATIONS_ADMIN,
    Role.SALES_PERSON,
    Role.SALES,
    Role.PRINTING,
    Role.PRINT_OPS,
    Role.SCHOOL_ADMIN
  )
  createReprintBatch(@Req() req: AuthRequest, @Body() dto: CreateReprintBatchDto) {
    return this.adminService.createReprintBatch(req.user, dto);
  }

  @Patch("print-jobs/:printJobId/status")
  @Roles(
    Role.SUPER_ADMIN,
    Role.COMPANY_ADMIN,
    Role.OPERATIONS_ADMIN,
    Role.PRINTING,
    Role.PRINT_OPS,
    Role.SCHOOL_ADMIN
  )
  updatePrintJobStatus(
    @Req() req: AuthRequest,
    @Param("printJobId") printJobId: string,
    @Body() dto: UpdatePrintJobStatusDto
  ) {
    return this.adminService.updatePrintJobStatus(req.user, printJobId, dto);
  }

  @Post("print-jobs/:printJobId/generate-artifact")
  @Roles(
    Role.SUPER_ADMIN,
    Role.COMPANY_ADMIN,
    Role.OPERATIONS_ADMIN,
    Role.PRINTING,
    Role.PRINT_OPS,
    Role.SCHOOL_ADMIN
  )
  generatePrintArtifact(
    @Req() req: AuthRequest,
    @Param("printJobId") printJobId: string,
    @Body() dto: GeneratePrintArtifactDto
  ) {
    return this.adminService.generatePrintArtifact(req.user, printJobId, dto);
  }

  @Get("print-jobs/:printJobId/export.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", "attachment; filename=print-job-export.csv")
  @Roles(
    Role.SUPER_ADMIN,
    Role.COMPANY_ADMIN,
    Role.OPERATIONS_ADMIN,
    Role.PRINTING,
    Role.PRINT_OPS,
    Role.SCHOOL_ADMIN
  )
  exportPrintJobCsv(@Req() req: AuthRequest, @Param("printJobId") printJobId: string) {
    return this.adminService.exportPrintJobCsv(req.user, printJobId);
  }

  @Post("print-jobs/:printJobId/mark-issued")
  @Roles(
    Role.SUPER_ADMIN,
    Role.COMPANY_ADMIN,
    Role.OPERATIONS_ADMIN,
    Role.PRINTING,
    Role.PRINT_OPS,
    Role.SCHOOL_ADMIN
  )
  markPrintJobIssued(
    @Req() req: AuthRequest,
    @Param("printJobId") printJobId: string,
    @Body() dto: MarkPrintJobIssuedDto
  ) {
    return this.adminService.markPrintJobIssued(req.user, printJobId, dto);
  }

  @Get("print-jobs")
  @Roles(
    Role.SUPER_ADMIN,
    Role.COMPANY_ADMIN,
    Role.OPERATIONS_ADMIN,
    Role.SALES_PERSON,
    Role.SALES,
    Role.PRINTING,
    Role.SCHOOL_ADMIN
  )
  listPrintJobs(@Req() req: AuthRequest) {
    return this.adminService.listPrintJobs(req.user);
  }

  @Get("print-jobs/:printJobId")
  @Roles(
    Role.SUPER_ADMIN,
    Role.COMPANY_ADMIN,
    Role.OPERATIONS_ADMIN,
    Role.SALES_PERSON,
    Role.SALES,
    Role.PRINTING,
    Role.PRINT_OPS,
    Role.SCHOOL_ADMIN
  )
  getPrintJob(@Req() req: AuthRequest, @Param("printJobId") printJobId: string) {
    return this.adminService.getPrintJob(req.user, printJobId);
  }

  @Post("students/:studentId/reissue-request")
  @Roles(
    Role.SUPER_ADMIN,
    Role.COMPANY_ADMIN,
    Role.OPERATIONS_ADMIN,
    Role.SALES_PERSON,
    Role.SALES,
    Role.PRINTING,
    Role.PRINT_OPS,
    Role.SCHOOL_ADMIN,
    Role.SCHOOL_STAFF
  )
  requestStudentReissue(
    @Req() req: AuthRequest,
    @Param("studentId") studentId: string,
    @Body() dto: RequestReissueDto
  ) {
    return this.adminService.requestStudentReissue(req.user, studentId, dto);
  }

  @Get("audit-logs")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.HR, Role.HR_ADMIN)
  listAuditLogs(
    @Req() req: AuthRequest,
    @Query("entityType") entityType?: string,
    @Query("actorUserId") actorUserId?: string,
    @Query("page") page?: number,
    @Query("pageSize") pageSize?: number
  ) {
    return this.adminService.listAuditLogs(req.user, { entityType, actorUserId, page, pageSize });
  }

  @Patch("schools/:schoolId")
  @UseGuards(TenantScopeGuard)
  @TenantScope({ sources: [{ type: "param", key: "schoolId" }] })
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES)
  updateSchool(@Req() req: AuthRequest, @Param("schoolId") schoolId: string, @Body() dto: UpdateSchoolDto) {
    return this.adminService.updateSchool(req.user, schoolId, dto);
  }

  @Patch("students/:studentId")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES)
  updateStudent(@Req() req: AuthRequest, @Param("studentId") studentId: string, @Body() dto: UpdateStudentDto) {
    return this.adminService.updateStudent(req.user, studentId, dto);
  }

  @Get("review-queue")
  @UseGuards(TenantScopeGuard)
  @TenantScope({ sources: [{ type: "query", key: "schoolId" }], optional: true })
  @Roles(
    Role.SUPER_ADMIN,
    Role.COMPANY_ADMIN,
    Role.OPERATIONS_ADMIN,
    Role.SALES_PERSON,
    Role.SALES,
    Role.SCHOOL_ADMIN,
    Role.SCHOOL_STAFF
  )
  listReviewQueue(
    @Req() req: AuthRequest,
    @Query("schoolId") schoolId?: string,
    @Query("intakeStage", new ParseEnumPipe(IntakeSubmissionStage, { optional: true }))
    intakeStage?: IntakeSubmissionStage,
    @Query("duplicateOnly") duplicateOnly?: string,
    @Query("q") q?: string,
    @Query("page") page?: number,
    @Query("pageSize") pageSize?: number
  ) {
    return this.adminService.listReviewQueue(req.user, {
      schoolId,
      intakeStage,
      duplicateOnly,
      q,
      page,
      pageSize
    });
  }

  @Patch("students/:studentId/correction")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES)
  applyCorrection(
    @Req() req: AuthRequest,
    @Param("studentId") studentId: string,
    @Body() dto: ApplyCorrectionDto
  ) {
    return this.adminService.applyCorrection(req.user, studentId, dto);
  }

  @Get("students/:studentId/corrections")
  @Roles(
    Role.SUPER_ADMIN,
    Role.COMPANY_ADMIN,
    Role.OPERATIONS_ADMIN,
    Role.SALES_PERSON,
    Role.SALES,
    Role.SCHOOL_ADMIN,
    Role.SCHOOL_STAFF
  )
  listStudentCorrections(@Req() req: AuthRequest, @Param("studentId") studentId: string) {
    return this.adminService.listStudentCorrections(req.user, studentId);
  }

  @Post("students/:studentId/validate")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES)
  validateStudent(
    @Req() req: AuthRequest,
    @Param("studentId") studentId: string,
    @Body() dto: ValidateStudentDto
  ) {
    return this.adminService.validateStudent(req.user, studentId, dto);
  }

  @Post("students/:studentId/photo-replace")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES)
  replaceStudentPhoto(
    @Req() req: AuthRequest,
    @Param("studentId") studentId: string,
    @Body() dto: ReplaceStudentPhotoDto
  ) {
    return this.adminService.replaceStudentPhoto(req.user, studentId, dto);
  }

  @Post("students/:studentId/merge-duplicate")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES)
  mergeDuplicate(
    @Req() req: AuthRequest,
    @Param("studentId") studentId: string,
    @Body() dto: MergeDuplicateDto
  ) {
    return this.adminService.mergeDuplicate(req.user, studentId, dto);
  }

  @Post("students/:studentId/handoff")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN)
  handoffStudent(
    @Req() req: AuthRequest,
    @Param("studentId") studentId: string,
    @Body() dto: HandoffStudentDto
  ) {
    return this.adminService.handoffStudent(req.user, studentId, dto);
  }

  @Get("schools/:schoolId/approval-chains")
  @UseGuards(TenantScopeGuard)
  @TenantScope({ sources: [{ type: "param", key: "schoolId" }] })
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN)
  listApprovalChains(
    @Req() req: AuthRequest,
    @Param("schoolId") schoolId: string,
    @Query("institutionType", new ParseEnumPipe(InstitutionType, { optional: true })) institutionType?: InstitutionType
  ) {
    return this.adminService.listApprovalChains(req.user, schoolId, institutionType);
  }

  @Post("schools/:schoolId/approval-chains")
  @UseGuards(TenantScopeGuard)
  @TenantScope({ sources: [{ type: "param", key: "schoolId" }] })
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN)
  createApprovalChain(
    @Req() req: AuthRequest,
    @Param("schoolId") schoolId: string,
    @Body() dto: CreateApprovalChainDto
  ) {
    return this.adminService.createApprovalChain(req.user, schoolId, dto);
  }

  @Post("approval-chains/:chainId/activate")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN)
  activateApprovalChain(
    @Req() req: AuthRequest,
    @Param("chainId") chainId: string,
    @Body() dto: ActivateApprovalChainDto
  ) {
    return this.adminService.activateApprovalChain(req.user, chainId, dto);
  }

  @Get("approval-workflows")
  @UseGuards(TenantScopeGuard)
  @TenantScope({ sources: [{ type: "query", key: "schoolId" }], optional: true })
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
  listApprovalWorkflows(
    @Req() req: AuthRequest,
    @Query("schoolId") schoolId?: string,
    @Query("status", new ParseEnumPipe(ApprovalWorkflowStatus, { optional: true })) status?: ApprovalWorkflowStatus,
    @Query("studentId") studentId?: string,
    @Query("chainId") chainId?: string,
    @Query("page") page?: number,
    @Query("pageSize") pageSize?: number
  ) {
    return this.adminService.listApprovalWorkflows(req.user, { schoolId, status, studentId, chainId, page, pageSize });
  }

  @Get("approval-workflows/:workflowId")
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
  getApprovalWorkflow(@Req() req: AuthRequest, @Param("workflowId") workflowId: string) {
    return this.adminService.getApprovalWorkflow(req.user, workflowId);
  }

  @Post("students/:studentId/approval-workflow/start")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN)
  startApprovalWorkflow(
    @Req() req: AuthRequest,
    @Param("studentId") studentId: string,
    @Body() dto: StartApprovalWorkflowDto
  ) {
    return this.adminService.startApprovalWorkflow(req.user, studentId, dto);
  }

  @Post("approval-workflows/:workflowId/actions")
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
  actOnApprovalWorkflow(
    @Req() req: AuthRequest,
    @Param("workflowId") workflowId: string,
    @Body() dto: ApprovalWorkflowActionDto
  ) {
    return this.adminService.actOnApprovalWorkflow(req.user, workflowId, dto);
  }

  @Post("approval-workflows/bulk-actions")
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
  bulkActOnApprovalWorkflow(@Req() req: AuthRequest, @Body() dto: BulkApprovalWorkflowActionDto) {
    return this.adminService.bulkActOnApprovalWorkflow(req.user, dto);
  }

  @Post("schools/:schoolId/templates")
  @UseGuards(TenantScopeGuard)
  @TenantScope({ sources: [{ type: "param", key: "schoolId" }] })
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN)
  createTemplate(
    @Req() req: AuthRequest,
    @Param("schoolId") schoolId: string,
    @Body() dto: CreateTemplateDto
  ) {
    return this.adminService.createTemplate(req.user, schoolId, dto);
  }

  @Get("schools/:schoolId/templates")
  @UseGuards(TenantScopeGuard)
  @TenantScope({ sources: [{ type: "param", key: "schoolId" }] })
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN)
  listTemplates(@Req() req: AuthRequest, @Param("schoolId") schoolId: string) {
    return this.adminService.listTemplates(req.user, schoolId);
  }

  @Get("templates/:templateId")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN)
  getTemplate(@Req() req: AuthRequest, @Param("templateId") templateId: string) {
    return this.adminService.getTemplate(req.user, templateId);
  }

  @Post("templates/:templateId/activate")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN)
  activateTemplate(
    @Req() req: AuthRequest,
    @Param("templateId") templateId: string,
    @Body() dto: ActivateTemplateDto
  ) {
    return this.adminService.activateTemplate(req.user, templateId, dto);
  }

  @Post("templates/:templateId/duplicate")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN)
  duplicateTemplate(
    @Req() req: AuthRequest,
    @Param("templateId") templateId: string,
    @Body() dto: DuplicateTemplateDto
  ) {
    return this.adminService.duplicateTemplate(req.user, templateId, dto);
  }

  @Patch("templates/:templateId/status")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN)
  updateTemplateStatus(
    @Req() req: AuthRequest,
    @Param("templateId") templateId: string,
    @Body() dto: UpdateTemplateStatusDto
  ) {
    return this.adminService.updateTemplateStatus(req.user, templateId, dto);
  }

  @Post("templates/:templateId/archive")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN)
  archiveTemplate(@Req() req: AuthRequest, @Param("templateId") templateId: string) {
    return this.adminService.updateTemplateStatus(req.user, templateId, {
      status: TemplateLifecycleStatus.ARCHIVED,
      notes: "Archived by operator"
    });
  }

  @Patch("templates/:templateId/mapping")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN)
  updateTemplateMapping(
    @Req() req: AuthRequest,
    @Param("templateId") templateId: string,
    @Body() dto: UpdateTemplateMappingDto
  ) {
    return this.adminService.updateTemplateMapping(req.user, templateId, dto);
  }

  @Get("templates/:templateId/snapshots")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN)
  listTemplateSnapshots(@Req() req: AuthRequest, @Param("templateId") templateId: string) {
    return this.adminService.listTemplateSnapshots(req.user, templateId);
  }

  @Post("templates/:templateId/render-preview")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN)
  renderTemplatePreview(
    @Req() req: AuthRequest,
    @Param("templateId") templateId: string,
    @Body() dto: RenderTemplatePreviewDto
  ) {
    return this.adminService.renderTemplatePreview(req.user, templateId, dto);
  }

  @Post("templates/:templateId/bind-campaign")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN)
  bindTemplateToCampaign(
    @Req() req: AuthRequest,
    @Param("templateId") templateId: string,
    @Body() dto: BindTemplateCampaignDto
  ) {
    return this.adminService.bindTemplateToCampaign(req.user, templateId, dto);
  }

  @Post("templates/:templateId/rebind-proofs")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN)
  rebindTemplateProofs(
    @Req() req: AuthRequest,
    @Param("templateId") templateId: string,
    @Body() dto: RebindTemplateProofsDto
  ) {
    return this.adminService.rebindTemplateProofs(req.user, templateId, dto);
  }

  @Get("schools/:schoolId/template-assignments")
  @UseGuards(TenantScopeGuard)
  @TenantScope({ sources: [{ type: "param", key: "schoolId" }] })
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN)
  listTemplateAssignments(@Req() req: AuthRequest, @Param("schoolId") schoolId: string) {
    return this.adminService.listTemplateAssignments(req.user, schoolId);
  }

  @Post("schools/:schoolId/template-assignments")
  @UseGuards(TenantScopeGuard)
  @TenantScope({ sources: [{ type: "param", key: "schoolId" }] })
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN)
  upsertTemplateAssignment(
    @Req() req: AuthRequest,
    @Param("schoolId") schoolId: string,
    @Body() dto: UpsertTemplateAssignmentDto
  ) {
    return this.adminService.upsertTemplateAssignment(req.user, schoolId, dto);
  }

  @Get("schools/:schoolId/template-resolver")
  @UseGuards(TenantScopeGuard)
  @TenantScope({ sources: [{ type: "param", key: "schoolId" }] })
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN)
  resolveTemplateAssignment(
    @Req() req: AuthRequest,
    @Param("schoolId") schoolId: string,
    @Query("intakeLinkId") intakeLinkId?: string,
    @Query("className") className?: string,
    @Query("section") section?: string,
    @Query("cardType") cardType?: string
  ) {
    return this.adminService.resolveTemplateForContext(req.user, schoolId, {
      intakeLinkId,
      className,
      section,
      cardType
    });
  }

  @Post("templates/:templateId/render-batches")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN)
  createRenderBatch(
    @Req() req: AuthRequest,
    @Param("templateId") templateId: string,
    @Body() dto: CreateRenderBatchDto
  ) {
    return this.adminService.createRenderBatch(req.user, templateId, dto);
  }

  @Get("schools/:schoolId/render-batches")
  @UseGuards(TenantScopeGuard)
  @TenantScope({ sources: [{ type: "param", key: "schoolId" }] })
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN, Role.PRINTING, Role.PRINT_OPS)
  listRenderBatches(@Req() req: AuthRequest, @Param("schoolId") schoolId: string) {
    return this.adminService.listRenderBatches(req.user, schoolId);
  }

  @Get("render-batches/:batchId")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN, Role.PRINTING, Role.PRINT_OPS)
  getRenderBatch(@Req() req: AuthRequest, @Param("batchId") batchId: string) {
    return this.adminService.getRenderBatch(req.user, batchId);
  }

  @Post("render-batches/:batchId/export")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN, Role.PRINTING, Role.PRINT_OPS)
  exportRenderBatch(
    @Req() req: AuthRequest,
    @Param("batchId") batchId: string,
    @Body() dto: ExportRenderBatchDto
  ) {
    return this.adminService.exportRenderBatch(req.user, batchId, dto);
  }

  @Get("template-tokens")
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES, Role.SCHOOL_ADMIN)
  listTemplateTokens() {
    return this.adminService.listTemplateTokens();
  }
}
