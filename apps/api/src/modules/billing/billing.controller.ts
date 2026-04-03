import { Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { BillingService } from "./billing.service";
import { AuthenticatedUser } from "../../common/auth/auth-user.type";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantScopeGuard } from "../../common/guards/tenant-scope.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { TenantScope } from "../../common/decorators/tenant-scope.decorator";
import { Role } from "../../common/enums/role.enum";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { CreateRazorpayOrderDto } from "./dto/create-razorpay-order.dto";
import { VerifyRazorpayPaymentDto } from "./dto/verify-razorpay-payment.dto";

@Controller("billing")
@UseGuards(JwtAuthGuard, RolesGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post("invoices")
  @UseGuards(TenantScopeGuard)
  @TenantScope({ sources: [{ type: "body", key: "schoolId" }] })
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.SALES_PERSON, Role.SALES)
  createInvoice(
    @Body() dto: CreateInvoiceDto,
    @Req() req: { user: AuthenticatedUser }
  ) {
    return this.billingService.createInvoice(dto, req.user);
  }

  @Get("invoices")
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
    Role.FINANCE
  )
  listInvoices(
    @Query("schoolId") schoolId: string | undefined,
    @Req() req: { user: AuthenticatedUser }
  ) {
    return this.billingService.listInvoices(req.user, schoolId);
  }

  @Get("reconciliation")
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
    Role.FINANCE
  )
  reconciliation(
    @Req() req: { user: AuthenticatedUser },
    @Query("schoolId") schoolId?: string,
    @Query("start") start?: string,
    @Query("end") end?: string
  ) {
    return this.billingService.reconciliation(req.user, { schoolId, start, end });
  }

  @Post("razorpay/order")
  @UseGuards(TenantScopeGuard)
  @TenantScope({ sources: [{ type: "body", key: "schoolId" }], optional: true })
  @Roles(
    Role.SUPER_ADMIN,
    Role.COMPANY_ADMIN,
    Role.OPERATIONS_ADMIN,
    Role.SALES_PERSON,
    Role.SALES,
    Role.SCHOOL_ADMIN,
    Role.SCHOOL_STAFF,
    Role.FINANCE
  )
  createRazorpayOrder(@Body() dto: CreateRazorpayOrderDto, @Req() req: { user: AuthenticatedUser }) {
    return this.billingService.createRazorpayOrder(dto, req.user);
  }

  @Post("razorpay/verify")
  @Roles(
    Role.SUPER_ADMIN,
    Role.COMPANY_ADMIN,
    Role.OPERATIONS_ADMIN,
    Role.SALES_PERSON,
    Role.SALES,
    Role.SCHOOL_ADMIN,
    Role.SCHOOL_STAFF,
    Role.FINANCE
  )
  verifyRazorpayPayment(@Body() dto: VerifyRazorpayPaymentDto, @Req() req: { user: AuthenticatedUser }) {
    return this.billingService.verifyRazorpayPayment(dto, req.user);
  }

  @Get("payments")
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
    Role.FINANCE
  )
  listPayments(
    @Req() req: { user: AuthenticatedUser },
    @Query("schoolId") schoolId?: string,
    @Query("invoiceId") invoiceId?: string
  ) {
    return this.billingService.listPayments(req.user, schoolId, invoiceId);
  }
}
