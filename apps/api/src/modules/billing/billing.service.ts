import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHmac } from "crypto";
import { AccessControlService } from "../../common/access/access-control.service";
import { AuthenticatedUser } from "../../common/auth/auth-user.type";
import { hasGlobalTenantAccess, isSalesRole, isSchoolRole } from "../../common/auth/role.utils";
import { Role } from "../../common/enums/role.enum";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { CreateRazorpayOrderDto } from "./dto/create-razorpay-order.dto";
import { VerifyRazorpayPaymentDto } from "./dto/verify-razorpay-payment.dto";

type ReconciliationQuery = { schoolId?: string; start?: string; end?: string };

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControlService: AccessControlService
  ) {}

  async createInvoice(dto: CreateInvoiceDto, actor: AuthenticatedUser) {
    await this.assertSchoolBillingAccess(actor, dto.schoolId);

    const school = await this.prisma.school.findUnique({ where: { id: dto.schoolId } });
    if (!school) throw new NotFoundException("School not found");

    const taxPercent = dto.taxPercent ?? 18;
    const taxAmount = (dto.amount * taxPercent) / 100;
    const totalAmount = dto.amount + taxAmount;

    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNo: `INV-${Date.now()}`,
        schoolId: dto.schoolId,
        amount: dto.amount,
        taxAmount,
        totalAmount,
        amountPaid: 0,
        status: "UNPAID",
        dueAt: new Date(dto.dueAt),
        notes: dto.notes,
        createdById: actor.sub
      },
      include: {
        school: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, email: true, role: true } }
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "INVOICE",
        entityId: invoice.id,
        action: "CREATE"
      }
    });

    return invoice;
  }

  async listInvoices(actor: AuthenticatedUser, schoolId?: string) {
    const scope = await this.resolveScope(actor, schoolId);
    return this.prisma.invoice.findMany({
      where: {
        ...(scope.schoolIdFilter ? { schoolId: { in: scope.schoolIdFilter } } : {}),
        ...(scope.dateFilter || {})
      },
      orderBy: { issuedAt: "desc" },
      include: {
        school: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, email: true, role: true } }
      },
      take: 100
    });
  }

  async reconciliation(actor: AuthenticatedUser, query: ReconciliationQuery) {
    const scope = await this.resolveScope(actor, query.schoolId, query.start, query.end);
    const now = new Date();

    const rows = await this.prisma.invoice.findMany({
      where: {
        ...(scope.schoolIdFilter ? { schoolId: { in: scope.schoolIdFilter } } : {}),
        ...(scope.dateFilter || {})
      },
      orderBy: { issuedAt: "desc" },
      select: {
        id: true,
        schoolId: true,
        status: true,
        totalAmount: true,
        amountPaid: true,
        dueAt: true,
        school: { select: { id: true, name: true, code: true } }
      }
    });

    const totals = {
      invoiced: 0,
      collected: 0,
      outstanding: 0,
      overdue: 0,
      overdueCount: 0,
      invoiceCount: rows.length
    };
    const statusMap = new Map<
      string,
      { status: string; count: number; total: number; paid: number; outstanding: number }
    >();
    const schoolMap = new Map<
      string,
      { schoolId: string; schoolName: string; schoolCode: string; total: number; paid: number; outstanding: number }
    >();
    const agingBuckets = [
      { bucket: "0-30", count: 0, amount: 0 },
      { bucket: "31-60", count: 0, amount: 0 },
      { bucket: "61-90", count: 0, amount: 0 },
      { bucket: "90+", count: 0, amount: 0 }
    ];

    rows.forEach((row) => {
      const total = this.decimalToNumber(row.totalAmount);
      const paid = this.decimalToNumber(row.amountPaid);
      const outstanding = Math.max(total - paid, 0);

      totals.invoiced += total;
      totals.collected += paid;
      totals.outstanding += outstanding;

      const statusKey = row.status;
      if (!statusMap.has(statusKey)) {
        statusMap.set(statusKey, {
          status: statusKey,
          count: 0,
          total: 0,
          paid: 0,
          outstanding: 0
        });
      }
      const statusRow = statusMap.get(statusKey)!;
      statusRow.count += 1;
      statusRow.total += total;
      statusRow.paid += paid;
      statusRow.outstanding += outstanding;

      const schoolName = row.school?.name || "Unknown";
      const schoolCode = row.school?.code || "--";
      if (!schoolMap.has(row.schoolId)) {
        schoolMap.set(row.schoolId, {
          schoolId: row.schoolId,
          schoolName,
          schoolCode,
          total: 0,
          paid: 0,
          outstanding: 0
        });
      }
      const schoolRow = schoolMap.get(row.schoolId)!;
      schoolRow.total += total;
      schoolRow.paid += paid;
      schoolRow.outstanding += outstanding;

      if (row.dueAt && outstanding > 0) {
        const dueDate = new Date(row.dueAt);
        if (dueDate < now) {
          totals.overdue += outstanding;
          totals.overdueCount += 1;
          const days = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          if (days <= 30) agingBuckets[0].amount += outstanding, (agingBuckets[0].count += 1);
          else if (days <= 60) agingBuckets[1].amount += outstanding, (agingBuckets[1].count += 1);
          else if (days <= 90) agingBuckets[2].amount += outstanding, (agingBuckets[2].count += 1);
          else agingBuckets[3].amount += outstanding, (agingBuckets[3].count += 1);
        }
      }
    });

    return {
      serverTime: now.toISOString(),
      totals: {
        ...totals,
        invoiced: this.round2(totals.invoiced),
        collected: this.round2(totals.collected),
        outstanding: this.round2(totals.outstanding),
        overdue: this.round2(totals.overdue)
      },
      byStatus: Array.from(statusMap.values())
        .map((r) => ({
          ...r,
          total: this.round2(r.total),
          paid: this.round2(r.paid),
          outstanding: this.round2(r.outstanding)
        }))
        .sort((a, b) => b.total - a.total),
      aging: agingBuckets.map((b) => ({ ...b, amount: this.round2(b.amount) })),
      topSchools: Array.from(schoolMap.values())
        .map((r) => ({
          ...r,
          total: this.round2(r.total),
          paid: this.round2(r.paid),
          outstanding: this.round2(r.outstanding)
        }))
        .sort((a, b) => b.outstanding - a.outstanding)
        .slice(0, 8)
    };
  }

  async createRazorpayOrder(dto: CreateRazorpayOrderDto, actor: AuthenticatedUser) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: dto.invoiceId },
      include: { school: { select: { id: true, name: true, code: true } } }
    });
    if (!invoice) throw new NotFoundException("Invoice not found");
    await this.assertSchoolBillingAccess(actor, invoice.schoolId);

    const invoiceTotal = this.decimalToNumber(invoice.totalAmount);
    const paid = this.decimalToNumber(invoice.amountPaid);
    const outstanding = Math.max(invoiceTotal - paid, 0);
    const requestedAmount = dto.amount ?? outstanding;
    if (requestedAmount <= 0) {
      throw new ForbiddenException("Invoice is already fully paid");
    }
    if (requestedAmount > outstanding) {
      throw new ForbiddenException("Requested payment amount exceeds outstanding balance");
    }

    const currency = (dto.currency || invoice.currency || "INR").toUpperCase();
    const receipt = dto.receipt || `${invoice.invoiceNo}-${Date.now()}`;
    const amountPaise = Math.round(requestedAmount * 100);

    const razorpayKeyId = process.env.RAZORPAY_KEY_ID || "";
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || "";
    let providerOrderId = `order_mock_${Date.now()}`;
    let providerResponse: Record<string, unknown> = { mode: "mock" };

    if (razorpayKeyId && razorpayKeySecret) {
      const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64");
      const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: amountPaise,
          currency,
          receipt,
          notes: {
            invoiceId: invoice.id,
            schoolId: invoice.schoolId,
            schoolCode: invoice.school?.code || ""
          }
        })
      });
      const payload = (await orderRes.json()) as Record<string, unknown>;
      if (!orderRes.ok) {
        throw new ForbiddenException(
          `Razorpay order creation failed: ${
            (payload.error as { description?: string })?.description || "unknown error"
          }`
        );
      }
      providerOrderId = String(payload.id || providerOrderId);
      providerResponse = payload;
    }

    const ledger = await this.prisma.paymentLedger.create({
      data: {
        schoolId: invoice.schoolId,
        invoiceId: invoice.id,
        provider: "RAZORPAY",
        providerOrderId,
        amount: requestedAmount,
        currency,
        status: "CREATED",
        createdById: actor.sub,
        metaJson: {
          receipt,
          amountPaise,
          providerResponse
        } as Prisma.InputJsonValue
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "PAYMENT",
        entityId: ledger.id,
        action: "RAZORPAY_ORDER_CREATED",
        newValue: {
          invoiceId: invoice.id,
          schoolId: invoice.schoolId,
          providerOrderId,
          amount: requestedAmount,
          currency
        }
      }
    });

    return {
      paymentLedgerId: ledger.id,
      invoiceId: invoice.id,
      provider: "RAZORPAY",
      keyId: razorpayKeyId || "RAZORPAY_KEY_ID_NOT_SET",
      order: {
        id: providerOrderId,
        amount: amountPaise,
        currency,
        receipt
      },
      mode: razorpayKeyId && razorpayKeySecret ? "live" : "mock"
    };
  }

  async verifyRazorpayPayment(dto: VerifyRazorpayPaymentDto, actor: AuthenticatedUser) {
    const ledger = await this.prisma.paymentLedger.findUnique({
      where: { providerOrderId: dto.razorpayOrderId },
      include: { invoice: true }
    });
    if (!ledger || !ledger.invoiceId || !ledger.invoice) {
      throw new NotFoundException("Payment order not found");
    }
    await this.assertSchoolBillingAccess(actor, ledger.schoolId);

    const secret = process.env.RAZORPAY_KEY_SECRET || "";
    if (!secret) {
      throw new UnauthorizedException("RAZORPAY_KEY_SECRET is not configured");
    }
    const generated = createHmac("sha256", secret)
      .update(`${dto.razorpayOrderId}|${dto.razorpayPaymentId}`)
      .digest("hex");
    if (generated !== dto.razorpaySignature) {
      await this.prisma.paymentLedger.update({
        where: { id: ledger.id },
        data: {
          status: "FAILED",
          providerPaymentId: dto.razorpayPaymentId,
          providerSignature: dto.razorpaySignature
        }
      });
      throw new ForbiddenException("Invalid Razorpay signature");
    }

    const invoiceTotal = this.decimalToNumber(ledger.invoice.totalAmount);
    const alreadyPaid = this.decimalToNumber(ledger.invoice.amountPaid);
    const expected = this.decimalToNumber(ledger.amount);
    const amountPaid = dto.amountPaid ?? expected;
    const nextPaid = alreadyPaid + amountPaid;
    const nextStatus =
      nextPaid >= invoiceTotal ? "PAID" : nextPaid > 0 ? "PARTIAL" : ledger.invoice.status;

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedLedger = await tx.paymentLedger.update({
        where: { id: ledger.id },
        data: {
          status: "CAPTURED",
          providerPaymentId: dto.razorpayPaymentId,
          providerSignature: dto.razorpaySignature,
          metaJson: {
            ...(ledger.metaJson as Record<string, unknown> | null),
            verifiedAt: new Date().toISOString()
          }
        }
      });
      const updatedInvoice = await tx.invoice.update({
        where: { id: ledger.invoiceId! },
        data: {
          amountPaid: nextPaid,
          status: nextStatus
        }
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.sub,
          entityType: "PAYMENT",
          entityId: updatedLedger.id,
          action: "RAZORPAY_PAYMENT_CAPTURED",
          newValue: {
            invoiceId: updatedInvoice.id,
            razorpayOrderId: dto.razorpayOrderId,
            razorpayPaymentId: dto.razorpayPaymentId,
            amountPaid
          }
        }
      });
      return { updatedLedger, updatedInvoice };
    });

    return {
      payment: result.updatedLedger,
      invoice: result.updatedInvoice
    };
  }

  async listPayments(actor: AuthenticatedUser, schoolId?: string, invoiceId?: string) {
    const scope = await this.resolveScope(actor, schoolId);
    return this.prisma.paymentLedger.findMany({
      where: {
        ...(scope.schoolIdFilter ? { schoolId: { in: scope.schoolIdFilter } } : {}),
        ...(invoiceId ? { invoiceId } : {})
      },
      orderBy: { createdAt: "desc" },
      include: {
        school: { select: { id: true, name: true, code: true } },
        invoice: { select: { id: true, invoiceNo: true, totalAmount: true, amountPaid: true, status: true } },
        createdBy: { select: { id: true, email: true, role: true } }
      },
      take: 150
    });
  }

  private async resolveScope(actor: AuthenticatedUser, schoolId?: string, start?: string, end?: string) {
    let schoolIdFilter: string[] | undefined;
    if (isSchoolRole(actor.normalizedRole)) {
      if (!actor.schoolId) throw new ForbiddenException("School context missing");
      if (schoolId && schoolId !== actor.schoolId) {
        throw new ForbiddenException("School admin can only access own school billing");
      }
      schoolIdFilter = [actor.schoolId];
    } else if (isSalesRole(actor.normalizedRole)) {
      const ids = actor.assignedSchoolIds.length ? actor.assignedSchoolIds : ["__none__"];
      if (schoolId && !ids.includes(schoolId)) {
        throw new ForbiddenException("Sales can only access assigned school billing");
      }
      schoolIdFilter = schoolId ? [schoolId] : ids;
    } else if (hasGlobalTenantAccess(actor.normalizedRole) || actor.normalizedRole === Role.FINANCE) {
      schoolIdFilter = schoolId ? [schoolId] : undefined;
    } else {
      throw new ForbiddenException("Role not allowed for billing access");
    }

    let dateFilter: { issuedAt?: Prisma.DateTimeFilter } | undefined;
    if (start || end) {
      const issuedAt: Prisma.DateTimeFilter = {};
      if (start) issuedAt.gte = new Date(start);
      if (end) {
        const d = new Date(end);
        d.setHours(23, 59, 59, 999);
        issuedAt.lte = d;
      }
      dateFilter = { issuedAt };
    }
    return { schoolIdFilter, dateFilter };
  }

  private async assertSchoolBillingAccess(actor: AuthenticatedUser, schoolId: string) {
    this.accessControlService.assertSchoolAccess(actor, schoolId);
    const scope = await this.resolveScope(actor, schoolId);
    if (!scope.schoolIdFilter?.includes(schoolId)) {
      throw new ForbiddenException("Not allowed for this school");
    }
  }

  private decimalToNumber(v: Prisma.Decimal | number | null | undefined) {
    if (v === null || v === undefined) return 0;
    if (typeof v === "number") return v;
    return Number(v.toString());
  }

  private round2(v: number) {
    return Number(v.toFixed(2));
  }
}
