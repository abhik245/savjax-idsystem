import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import {
  ApprovalRequestStatus,
  Prisma,
  SchoolStatus
} from "@prisma/client";
import { Role } from "../../common/enums/role.enum";
import { PrismaService } from "../../prisma/prisma.service";
import { OverviewDrilldownDto } from "./dto/overview-drilldown.dto";
import { OverviewFilterDto } from "./dto/overview-filter.dto";
import { OverviewSalesPerformanceDto } from "./dto/overview-sales-performance.dto";
import { OverviewTimeSeriesDto } from "./dto/overview-timeseries.dto";

type AuthUser = { sub: string; role: Role; schoolId?: string };

type SalesOwnerRow = {
  salesOwnerId: string | null;
  salesOwnerName: string;
  revenue: number;
  schoolsActive: number;
  studentsMTD: number;
};

@Injectable()
export class OverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async getKpis(actor: AuthUser, query: OverviewFilterDto) {
    this.assertSuperAdmin(actor);
    const schoolWhere = this.buildSchoolWhere(query);
    const schools = await this.prisma.school.findMany({
      where: schoolWhere,
      select: { id: true }
    });
    const schoolIds = schools.map((s) => s.id);
    const totalSchools = schoolIds.length;
    const serverTime = new Date();
    const [monthStart, monthEnd] = this.monthRangeOf(serverTime);
    const activeWindowStart = new Date(serverTime.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (!schoolIds.length) {
      return {
        totalSchools: 0,
        activeSchools: 0,
        pendingApprovals: 0,
        totalStudentsAllTime: 0,
        studentsMTD: 0,
        revenueMTD: 0,
        collectionsMTD: 0,
        outstandingAR: 0,
        grossMarginMTD: null,
        currency: "INR",
        serverTime: serverTime.toISOString()
      };
    }

    const [
      activeSchoolsRows,
      pendingApprovals,
      totalStudentsAllTime,
      studentsMTD,
      revenueAgg,
      collectionsAgg,
      openInvoices,
      costsAgg
    ] = await Promise.all([
      this.prisma.parentSubmission.findMany({
        where: { schoolId: { in: schoolIds }, submittedAt: { gte: activeWindowStart } },
        select: { schoolId: true },
        distinct: ["schoolId"]
      }),
      this.prisma.approvalRequest.count({
        where: { schoolId: { in: schoolIds }, status: ApprovalRequestStatus.PENDING }
      }),
      this.prisma.student.count({ where: { schoolId: { in: schoolIds }, deletedAt: null } }),
      this.prisma.student.count({
        where: {
          schoolId: { in: schoolIds },
          deletedAt: null,
          createdAt: { gte: monthStart, lte: monthEnd }
        }
      }),
      this.prisma.invoice.aggregate({
        where: { schoolId: { in: schoolIds }, issuedAt: { gte: monthStart, lte: monthEnd } },
        _sum: { totalAmount: true }
      }),
      this.prisma.invoice.aggregate({
        where: { schoolId: { in: schoolIds }, issuedAt: { gte: monthStart, lte: monthEnd } },
        _sum: { amountPaid: true }
      }),
      this.prisma.invoice.findMany({
        where: { schoolId: { in: schoolIds } },
        select: { totalAmount: true, amountPaid: true }
      }),
      this.prisma.cost.aggregate({
        where: { schoolId: { in: schoolIds }, costDate: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
        _count: { _all: true }
      })
    ]);

    const revenueMTD = this.decimalToNumber(revenueAgg._sum.totalAmount);
    const collectionsMTD = this.decimalToNumber(collectionsAgg._sum.amountPaid);
    const outstandingAR = openInvoices.reduce(
      (acc, row) => acc + Math.max(this.decimalToNumber(row.totalAmount) - this.decimalToNumber(row.amountPaid), 0),
      0
    );
    const costsMTD = this.decimalToNumber(costsAgg._sum.amount);
    const grossMarginMTD = costsAgg._count._all > 0 ? revenueMTD - costsMTD : null;

    return {
      totalSchools,
      activeSchools: activeSchoolsRows.length,
      pendingApprovals,
      totalStudentsAllTime,
      studentsMTD,
      revenueMTD,
      collectionsMTD,
      outstandingAR,
      grossMarginMTD,
      currency: "INR",
      serverTime: serverTime.toISOString()
    };
  }

  async getTimeSeries(actor: AuthUser, query: OverviewTimeSeriesDto) {
    this.assertSuperAdmin(actor);
    const [start, end] = this.resolveRange(query.start, query.end);
    const granularity = query.granularity || "daily";
    const schoolIds = await this.getSchoolIds(query);
    const pointsTemplate = this.buildEmptyPoints(start, end, granularity);

    if (!schoolIds.length) {
      return { metric: query.metric, granularity, points: pointsTemplate };
    }

    const map = new Map(pointsTemplate.map((p) => [p.date, 0]));
    if (query.metric === "submissions") {
      const rows = await this.prisma.parentSubmission.findMany({
        where: { schoolId: { in: schoolIds }, submittedAt: { gte: start, lte: end } },
        select: { submittedAt: true }
      });
      rows.forEach((r) => {
        const key = this.bucketKey(r.submittedAt, granularity);
        map.set(key, (map.get(key) || 0) + 1);
      });
    } else if (query.metric === "approvals") {
      const rows = await this.prisma.approvalRequest.findMany({
        where: {
          schoolId: { in: schoolIds },
          status: ApprovalRequestStatus.APPROVED,
          decidedAt: { gte: start, lte: end }
        },
        select: { decidedAt: true }
      });
      rows.forEach((r) => {
        if (!r.decidedAt) return;
        const key = this.bucketKey(r.decidedAt, granularity);
        map.set(key, (map.get(key) || 0) + 1);
      });
    } else {
      const rows = await this.prisma.invoice.findMany({
        where: { schoolId: { in: schoolIds }, issuedAt: { gte: start, lte: end } },
        select: { issuedAt: true, totalAmount: true }
      });
      rows.forEach((r) => {
        const key = this.bucketKey(r.issuedAt, granularity);
        map.set(key, (map.get(key) || 0) + this.decimalToNumber(r.totalAmount));
      });
    }

    return {
      metric: query.metric,
      granularity,
      points: pointsTemplate.map((p) => ({ date: p.date, value: Number((map.get(p.date) || 0).toFixed(2)) }))
    };
  }

  async getSalesPerformance(actor: AuthUser, query: OverviewSalesPerformanceDto) {
    this.assertSuperAdmin(actor);
    const [start, end] = this.resolveRange(query.start, query.end);
    const schoolWhere = this.buildSchoolWhere(query);
    const schools = await this.prisma.school.findMany({
      where: schoolWhere,
      select: {
        id: true,
        salesOwnerId: true,
        salesOwner: { select: { id: true, name: true, email: true } }
      }
    });
    if (!schools.length) return { rows: [] as SalesOwnerRow[] };

    const schoolIds = schools.map((s) => s.id);
    const [invoiceAgg, studentAgg, activeRows] = await Promise.all([
      this.prisma.invoice.groupBy({
        by: ["schoolId"],
        where: { schoolId: { in: schoolIds }, issuedAt: { gte: start, lte: end } },
        _sum: { totalAmount: true }
      }),
      this.prisma.student.groupBy({
        by: ["schoolId"],
        where: { schoolId: { in: schoolIds }, createdAt: { gte: start, lte: end }, deletedAt: null },
        _count: { _all: true }
      }),
      this.prisma.parentSubmission.findMany({
        where: { schoolId: { in: schoolIds }, submittedAt: { gte: start, lte: end } },
        select: { schoolId: true },
        distinct: ["schoolId"]
      })
    ]);

    const revenueBySchool = new Map(invoiceAgg.map((r) => [r.schoolId, this.decimalToNumber(r._sum.totalAmount)]));
    const studentsBySchool = new Map(studentAgg.map((r) => [r.schoolId, r._count._all]));
    const activeSet = new Set(activeRows.map((r) => r.schoolId));

    const byOwner = new Map<string, SalesOwnerRow>();
    schools.forEach((school) => {
      const key = school.salesOwnerId || "unassigned";
      if (!byOwner.has(key)) {
        byOwner.set(key, {
          salesOwnerId: school.salesOwnerId,
          salesOwnerName: school.salesOwner?.name || school.salesOwner?.email || "Unassigned",
          revenue: 0,
          schoolsActive: 0,
          studentsMTD: 0
        });
      }
      const row = byOwner.get(key)!;
      row.revenue += revenueBySchool.get(school.id) || 0;
      row.studentsMTD += studentsBySchool.get(school.id) || 0;
      if (activeSet.has(school.id)) row.schoolsActive += 1;
    });

    const limit = Math.min(query.limit || 10, 100);
    return {
      rows: Array.from(byOwner.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit)
    };
  }

  async getDrilldown(actor: AuthUser, query: OverviewDrilldownDto) {
    this.assertSuperAdmin(actor);
    const [start, end] = this.dayRange(query.date);
    const schools = await this.prisma.school.findMany({
      where: this.buildSchoolWhere(query),
      select: {
        id: true,
        name: true,
        salesOwner: { select: { name: true, email: true } }
      }
    });
    const schoolIds = schools.map((s) => s.id);
    if (!schoolIds.length) return { metric: query.metric, date: query.date, rows: [] };

    const schoolMap = new Map(schools.map((s) => [s.id, s]));
    if (query.metric === "submissions") {
      const rows = await this.prisma.parentSubmission.groupBy({
        by: ["schoolId"],
        where: { schoolId: { in: schoolIds }, submittedAt: { gte: start, lte: end } },
        _count: { _all: true }
      });
      return {
        metric: query.metric,
        date: query.date,
        rows: rows
          .map((row) => ({
            schoolId: row.schoolId,
            schoolName: schoolMap.get(row.schoolId)?.name || "Unknown",
            value: row._count._all,
            salesOwnerName:
              schoolMap.get(row.schoolId)?.salesOwner?.name ||
              schoolMap.get(row.schoolId)?.salesOwner?.email ||
              "Unassigned"
          }))
          .sort((a, b) => b.value - a.value)
      };
    }
    if (query.metric === "approvals") {
      const rows = await this.prisma.approvalRequest.groupBy({
        by: ["schoolId"],
        where: {
          schoolId: { in: schoolIds },
          status: ApprovalRequestStatus.APPROVED,
          decidedAt: { gte: start, lte: end }
        },
        _count: { _all: true }
      });
      return {
        metric: query.metric,
        date: query.date,
        rows: rows
          .map((row) => ({
            schoolId: row.schoolId,
            schoolName: schoolMap.get(row.schoolId)?.name || "Unknown",
            value: row._count._all,
            salesOwnerName:
              schoolMap.get(row.schoolId)?.salesOwner?.name ||
              schoolMap.get(row.schoolId)?.salesOwner?.email ||
              "Unassigned"
          }))
          .sort((a, b) => b.value - a.value)
      };
    }
    if (query.metric === "pending_approvals") {
      const rows = await this.prisma.approvalRequest.groupBy({
        by: ["schoolId"],
        where: {
          schoolId: { in: schoolIds },
          status: ApprovalRequestStatus.PENDING
        },
        _count: { _all: true }
      });
      return {
        metric: query.metric,
        date: query.date,
        rows: rows
          .map((row) => ({
            schoolId: row.schoolId,
            schoolName: schoolMap.get(row.schoolId)?.name || "Unknown",
            value: row._count._all,
            salesOwnerName:
              schoolMap.get(row.schoolId)?.salesOwner?.name ||
              schoolMap.get(row.schoolId)?.salesOwner?.email ||
              "Unassigned"
          }))
          .sort((a, b) => b.value - a.value)
      };
    }

    const rows = await this.prisma.invoice.groupBy({
      by: ["schoolId"],
      where: { schoolId: { in: schoolIds }, issuedAt: { gte: start, lte: end } },
      _sum: { totalAmount: true }
    });
    return {
      metric: query.metric,
      date: query.date,
      rows: rows
        .map((row) => ({
          schoolId: row.schoolId,
          schoolName: schoolMap.get(row.schoolId)?.name || "Unknown",
          value: this.decimalToNumber(row._sum.totalAmount),
          salesOwnerName:
            schoolMap.get(row.schoolId)?.salesOwner?.name ||
            schoolMap.get(row.schoolId)?.salesOwner?.email ||
            "Unassigned"
        }))
        .sort((a, b) => b.value - a.value)
    };
  }

  private async getSchoolIds(query: {
    salesOwnerId?: string;
    region?: string;
    status?: "ACTIVE" | "INACTIVE";
  }) {
    const schools = await this.prisma.school.findMany({
      where: this.buildSchoolWhere(query),
      select: { id: true }
    });
    return schools.map((s) => s.id);
  }

  private buildSchoolWhere(query: {
    salesOwnerId?: string;
    region?: string;
    status?: "ACTIVE" | "INACTIVE";
  }): Prisma.SchoolWhereInput {
    const where: Prisma.SchoolWhereInput = {
      deletedAt: null,
      status: query.status ? (query.status as SchoolStatus) : { not: SchoolStatus.ARCHIVED }
    };
    if (query.salesOwnerId) where.salesOwnerId = query.salesOwnerId;
    if (query.region?.trim()) {
      const term = query.region.trim();
      where.OR = [
        { city: { contains: term, mode: "insensitive" } },
        { state: { contains: term, mode: "insensitive" } },
        { region: { name: { contains: term, mode: "insensitive" } } },
        { region: { code: { contains: term, mode: "insensitive" } } }
      ];
    }
    return where;
  }

  private resolveRange(start?: string, end?: string) {
    const now = new Date();
    const defaultStart = new Date(now);
    defaultStart.setUTCDate(defaultStart.getUTCDate() - 29);
    defaultStart.setUTCHours(0, 0, 0, 0);
    const rangeStart = start ? new Date(start) : defaultStart;
    const rangeEnd = end ? new Date(end) : now;
    rangeStart.setUTCHours(0, 0, 0, 0);
    rangeEnd.setUTCHours(23, 59, 59, 999);
    if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime()) || rangeStart > rangeEnd) {
      throw new BadRequestException("Invalid date range");
    }
    return [rangeStart, rangeEnd] as const;
  }

  private monthRangeOf(base: Date) {
    const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    return [start, end] as const;
  }

  private dayRange(dateIso: string) {
    const d = new Date(dateIso);
    if (Number.isNaN(d.getTime())) throw new BadRequestException("Invalid date");
    const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
    const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
    return [start, end] as const;
  }

  private buildEmptyPoints(start: Date, end: Date, granularity: "daily" | "weekly") {
    const points: Array<{ date: string; value: number }> = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      points.push({ date: this.bucketKey(cursor, granularity), value: 0 });
      if (granularity === "daily") cursor.setUTCDate(cursor.getUTCDate() + 1);
      else cursor.setUTCDate(cursor.getUTCDate() + 7);
    }
    const dedup = new Map(points.map((p) => [p.date, p]));
    return Array.from(dedup.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  private bucketKey(date: Date, granularity: "daily" | "weekly") {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    if (granularity === "weekly") {
      const day = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() - day + 1);
    }
    return d.toISOString().slice(0, 10);
  }

  private decimalToNumber(value: Prisma.Decimal | number | null | undefined) {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number") return value;
    return Number(value.toString());
  }

  private assertSuperAdmin(actor: AuthUser) {
    if (actor.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException("Only SUPER_ADMIN can access admin overview");
    }
  }
}
