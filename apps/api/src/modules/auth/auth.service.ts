import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AccessControlService } from "../../common/access/access-control.service";
import { AuthenticatedUser } from "../../common/auth/auth-user.type";
import { Role } from "../../common/enums/role.enum";
import { DataProtectionService } from "../../common/services/data-protection.service";
import { getPermissionsForRole } from "../../common/auth/permission-matrix";
import {
  isCompanyAdminRole,
  isParentRole,
  isSchoolRole,
  isSuperAdminRole,
  normalizeRole
} from "../../common/auth/role.utils";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { SendOtpDto } from "./dto/send-otp.dto";
import { VerifyOtpDto } from "./dto/verify-otp.dto";
import * as bcrypt from "bcrypt";
import { createHash, randomBytes } from "crypto";
import { JwtPayload } from "./types/jwt-payload.type";

const OTP_WINDOW_MS = 10 * 60 * 1000;
const OTP_SEND_LIMIT = 6;
const OTP_VERIFY_LIMIT = 12;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPT_LIMIT = 10;
const LOCKOUT_AFTER_FAILED = 5;
const LOCKOUT_MINUTES = 15;
const ACCESS_TTL_SECONDS = 60 * 60;
const REFRESH_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
type Portal = "all" | "company" | "school";
type AuthResponseUser = {
  id: string;
  role: Role;
  schoolId: string | null;
  assignedSchoolIds: string[];
  parentId: string | null;
  permissions: string[];
  email?: string;
  name?: string | null;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly rateMap = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly accessControlService: AccessControlService,
    private readonly dataProtectionService: DataProtectionService
  ) {}

  me(user: AuthenticatedUser) {
    const normalizedRole = normalizeRole(user.normalizedRole) || user.role;
    const responseUser: AuthResponseUser = {
      id: user.sub,
      role: normalizedRole,
      schoolId: user.schoolId || null,
      assignedSchoolIds: user.assignedSchoolIds || [],
      parentId: user.parentId || null,
      permissions: user.permissions || getPermissionsForRole(normalizedRole),
      email: user.email,
      name: user.name
    };
    return { user: responseUser };
  }

  async login(dto: LoginDto, req: Request, res: Response, portal: Portal = "all") {
    const email = dto.email.toLowerCase().trim();
    this.assertRateLimit(`login:${email}`, LOGIN_ATTEMPT_LIMIT, LOGIN_WINDOW_MS, "Too many login attempts");
    this.assertRateLimit(
      `login-ip:${this.getIp(req)}`,
      LOGIN_ATTEMPT_LIMIT * 2,
      LOGIN_WINDOW_MS,
      "Too many login attempts"
    );

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash || user.deletedAt || !user.isActive) {
      throw new UnauthorizedException("Invalid credentials");
    }
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      throw new UnauthorizedException("Account locked due to repeated failures. Try later.");
    }

    const match = await bcrypt.compare(dto.password, user.passwordHash);
    if (!match) {
      await this.registerFailedLogin(user.id);
      await this.audit({
        actorUserId: user.id,
        action: "LOGIN_FAILED",
        entityId: user.id,
        ip: this.getIp(req),
        userAgent: req.headers["user-agent"] || undefined
      });
      throw new UnauthorizedException("Invalid credentials");
    }

    const normalizedRole = normalizeRole(user.role) as Role;
    this.assertPortalAccess(normalizedRole, portal);
    await this.assertMfaIfRequired(user.id, normalizedRole, dto.mfaCode);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockoutUntil: null,
        lastLoginAt: new Date()
      }
    });

    const scope = await this.accessControlService.getUserScope(user.id);
    const response = await this.issueTokens(scope, req, res, {
      deviceId: dto.deviceId || this.readDeviceId(req)
    });

    await this.audit({
      actorUserId: user.id,
      action: "LOGIN_SUCCESS",
      entityId: user.id,
      ip: this.getIp(req),
      userAgent: req.headers["user-agent"] || undefined
    });

    return response;
  }

  async sendParentOtp(dto: SendOtpDto, req: Request) {
    const ip = this.getIp(req);
    await this.assertParentOtpSendAllowed(dto.mobile, ip, req.headers["user-agent"] || undefined);
    const isProd = this.configService.get("NODE_ENV", "development") === "production";
    const code = isProd
      ? String(Math.floor(100000 + Math.random() * 900000))
      : this.configService.get("DEV_MASTER_OTP", "123456");

    await this.prisma.$transaction([
      this.prisma.otpChallenge.updateMany({
        where: { mobile: dto.mobile, consumedAt: null },
        data: { consumedAt: new Date() }
      }),
      this.prisma.otpChallenge.create({
        data: {
          mobile: dto.mobile,
          otpHash: this.hash(code),
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          requestedIp: ip,
          requestedAgent: req.headers["user-agent"] || undefined
        }
      })
    ]);

    await this.audit({
      action: "OTP_SENT",
      entityId: this.otpAuditEntityId(dto.mobile),
      ip,
      userAgent: req.headers["user-agent"] || undefined
    });
    return {
      message: "OTP sent",
      devOtp:
        !isProd && this.configService.get("AUTH_DEV_EXPOSE_OTP", "true") === "true" ? code : undefined
    };
  }

  async verifyParentOtp(dto: VerifyOtpDto, req: Request, res: Response) {
    const ip = this.getIp(req);
    await this.assertParentOtpVerifyAllowed(dto.mobile, ip, req.headers["user-agent"] || undefined);

    const challenge = await this.prisma.otpChallenge.findFirst({
      where: {
        mobile: dto.mobile,
        consumedAt: null
      },
      orderBy: { createdAt: "desc" }
    });
    if (!challenge) {
      await this.audit({
        action: "OTP_VERIFY_FAILED",
        entityId: this.otpAuditEntityId(dto.mobile),
        ip,
        userAgent: req.headers["user-agent"] || undefined,
        newValue: { reason: "NO_ACTIVE_CHALLENGE" }
      });
      throw new UnauthorizedException("OTP expired");
    }
    if (challenge.expiresAt < new Date()) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() }
      });
      await this.audit({
        action: "OTP_VERIFY_FAILED",
        entityId: this.otpAuditEntityId(dto.mobile),
        ip,
        userAgent: req.headers["user-agent"] || undefined,
        newValue: { reason: "EXPIRED_CHALLENGE" }
      });
      throw new UnauthorizedException("OTP expired");
    }
    if (challenge.otpHash !== this.hash(dto.otp)) {
      const nextAttempts = challenge.attempts + 1;
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: {
          attempts: nextAttempts,
          ...(nextAttempts >= challenge.maxAttempts ? { consumedAt: new Date() } : {})
        }
      });
      await this.audit({
        action: "OTP_VERIFY_FAILED",
        entityId: this.otpAuditEntityId(dto.mobile),
        ip,
        userAgent: req.headers["user-agent"] || undefined,
        newValue: {
          reason: "INVALID_OTP",
          attempts: nextAttempts,
          challengeId: challenge.id
        }
      });
      throw new UnauthorizedException("Invalid OTP");
    }

    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() }
    });

    let user = await this.prisma.user.findUnique({ where: { email: `${dto.mobile}@parent.local` } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: `${dto.mobile}@parent.local`,
          role: Role.PARENT,
          isActive: true,
          parent: { create: this.buildParentMobileData(dto.mobile) }
        }
      });
    } else {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { isActive: true, role: Role.PARENT }
      });
      const parent = await this.prisma.parent.findUnique({ where: { userId: user.id } });
      if (!parent) {
        await this.prisma.parent.create({
          data: { userId: user.id, ...this.buildParentMobileData(dto.mobile) }
        });
      } else if (!parent.mobileHash || !parent.mobileCiphertext || parent.mobile === dto.mobile) {
        await this.prisma.parent.update({
          where: { id: parent.id },
          data: this.buildParentMobileData(dto.mobile)
        });
      }
    }

    const scope = await this.accessControlService.getUserScope(user.id);
    const response = await this.issueTokens(scope, req, res, {
      deviceId: this.readDeviceId(req)
    });
    await this.audit({
      actorUserId: user.id,
      action: "OTP_LOGIN_SUCCESS",
      entityId: user.id,
      ip: this.getIp(req),
      userAgent: req.headers["user-agent"] || undefined
    });
    return response;
  }

  async refreshToken(dto: RefreshDto, req: Request, res: Response) {
    const rawRefresh = this.getRefreshToken(dto, req);
    if (!rawRefresh) throw new UnauthorizedException("Refresh token missing");

    const tokenHash = this.hash(rawRefresh);
    const session = await this.prisma.authSession.findUnique({ where: { refreshTokenHash: tokenHash } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid refresh token");
    }
    const deviceId = this.readDeviceId(req) || session.deviceId || undefined;
    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), revokedReason: "ROTATED" }
    });

    const scope = await this.accessControlService.getUserScope(session.userId);
    const response = await this.issueTokens(scope, req, res, {
      deviceId,
      rotatedFromId: session.id
    });
    await this.audit({
      actorUserId: session.userId,
      action: "TOKEN_REFRESH",
      entityId: session.id,
      ip: this.getIp(req),
      userAgent: req.headers["user-agent"] || undefined
    });

    return response;
  }

  async logout(dto: RefreshDto, req: Request, res: Response) {
    const rawRefresh = this.getRefreshToken(dto, req);
    const tokenHash = rawRefresh ? this.hash(rawRefresh) : undefined;
    if (tokenHash) {
      const existing = await this.prisma.authSession.findUnique({
        where: { refreshTokenHash: tokenHash },
        select: { id: true, userId: true }
      });
      await this.prisma.authSession.updateMany({
        where: { refreshTokenHash: tokenHash, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "LOGOUT" }
      });
      if (existing) {
        await this.audit({
          actorUserId: existing.userId,
          action: "LOGOUT",
          entityId: existing.id,
          ip: this.getIp(req),
          userAgent: req.headers["user-agent"] || undefined
        });
      }
    }
    this.clearAuthCookies(res);
    return { message: "Session revoked" };
  }

  async forgotPassword(dto: ForgotPasswordDto, req: Request) {
    const email = dto.email.toLowerCase().trim();
    this.assertRateLimit(`forgot:${email}`, 6, OTP_WINDOW_MS, "Too many requests");
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt || !user.isActive) {
      return { message: "If your email exists, a reset link has been sent." };
    }

    const token = randomBytes(32).toString("hex");
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hash(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        requestedIp: this.getIp(req),
        requestedAgent: req.headers["user-agent"] || undefined
      }
    });

    await this.audit({
      actorUserId: user.id,
      action: "PASSWORD_RESET_REQUESTED",
      entityId: user.id,
      ip: this.getIp(req),
      userAgent: req.headers["user-agent"] || undefined
    });

    return {
      message: "If your email exists, a reset link has been sent.",
      devResetToken:
        this.configService.get("NODE_ENV") === "production" ||
        this.configService.get("AUTH_DEV_EXPOSE_RESET_TOKEN", "false") !== "true"
          ? undefined
          : token
    };
  }

  async resetPassword(dto: ResetPasswordDto, req: Request, res: Response) {
    const tokenHash = this.hash(dto.token);
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    });
    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid or expired reset token");
    }
    if (!resetToken.user || resetToken.user.deletedAt || !resetToken.user.isActive) {
      throw new UnauthorizedException("User not active");
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash,
          forcePasswordReset: false,
          failedLoginCount: 0,
          lockoutUntil: null
        }
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() }
      }),
      this.prisma.authSession.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "PASSWORD_RESET" }
      })
    ]);

    await this.audit({
      actorUserId: resetToken.userId,
      action: "PASSWORD_RESET_COMPLETED",
      entityId: resetToken.userId,
      ip: this.getIp(req),
      userAgent: req.headers["user-agent"] || undefined
    });

    const scope = await this.accessControlService.getUserScope(resetToken.userId);
    return this.issueTokens(scope, req, res, {
      deviceId: this.readDeviceId(req)
    });
  }

  private async assertMfaIfRequired(userId: string, role: Role, providedCode?: string) {
    const shouldEnforce =
      this.configService.get("ENFORCE_ADMIN_MFA", "false") === "true" &&
      (isSuperAdminRole(role) || isCompanyAdminRole(role));
    if (!shouldEnforce) return;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true }
    });
    if (!user?.mfaEnabled) {
      throw new UnauthorizedException("MFA is required for this account");
    }

    const expected = this.configService.get("DEV_MFA_CODE", "000000");
    if (!providedCode || providedCode !== expected) {
      throw new UnauthorizedException("Invalid MFA code");
    }
  }

  private assertPortalAccess(role: Role, portal: Portal) {
    if (portal === "company") {
      if (isSchoolRole(role) || isParentRole(role)) {
        throw new ForbiddenException("Use school/parent portal for this account");
      }
      return;
    }
    if (portal === "school") {
      if (!isSchoolRole(role)) throw new ForbiddenException("Only school users can login here");
    }
  }

  private async issueTokens(
    scope: AuthenticatedUser,
    req: Request,
    res: Response,
    options?: { deviceId?: string; rotatedFromId?: string }
  ) {
    const refreshToken = randomBytes(48).toString("hex");
    const refreshTokenHash = this.hash(refreshToken);
    const session = await this.prisma.authSession.create({
      data: {
        userId: scope.sub,
        refreshTokenHash,
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        deviceId: options?.deviceId || null,
        rotatedFromId: options?.rotatedFromId || null,
        ipAddress: this.getIp(req),
        userAgent: req.headers["user-agent"] || undefined
      }
    });

    const normalizedRole = normalizeRole(scope.normalizedRole) || scope.role;
    const accessPayload: JwtPayload = {
      sub: scope.sub,
      role: normalizedRole,
      normalizedRole,
      schoolId: scope.schoolId,
      sid: session.id
    };
    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
      expiresIn: `${ACCESS_TTL_SECONDS}s`
    });

    this.setAuthCookies(res, accessToken, refreshToken);

    const responseUser: AuthResponseUser = {
      id: scope.sub,
      role: normalizedRole,
      schoolId: scope.schoolId || null,
      assignedSchoolIds: scope.assignedSchoolIds || [],
      parentId: scope.parentId || null,
      permissions: scope.permissions || getPermissionsForRole(normalizedRole),
      email: scope.email,
      name: scope.name
    };

    return {
      user: responseUser,
      role: responseUser.role,
      schoolId: responseUser.schoolId,
      assignedSchoolIds: responseUser.assignedSchoolIds,
      permissions: responseUser.permissions,
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresIn: ACCESS_TTL_SECONDS
    };
  }

  private getRefreshToken(dto: RefreshDto, req: Request) {
    return dto.refreshToken || this.readCookie(req, "nexid_refresh_token") || undefined;
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    const secure = this.configService.get("AUTH_COOKIE_SECURE", "false") === "true";
    const sameSite = (this.configService.get("AUTH_COOKIE_SAME_SITE", "lax") || "lax") as
      | "lax"
      | "strict"
      | "none";
    const domain = this.configService.get<string>("AUTH_COOKIE_DOMAIN") || undefined;

    res.cookie("nexid_access_token", accessToken, {
      httpOnly: true,
      secure,
      sameSite,
      domain,
      path: "/",
      maxAge: ACCESS_TTL_SECONDS * 1000
    });
    res.cookie("nexid_refresh_token", refreshToken, {
      httpOnly: true,
      secure,
      sameSite,
      domain,
      path: "/",
      maxAge: REFRESH_TTL_MS
    });
  }

  private clearAuthCookies(res: Response) {
    const secure = this.configService.get("AUTH_COOKIE_SECURE", "false") === "true";
    const sameSite = (this.configService.get("AUTH_COOKIE_SAME_SITE", "lax") || "lax") as
      | "lax"
      | "strict"
      | "none";
    const domain = this.configService.get<string>("AUTH_COOKIE_DOMAIN") || undefined;
    res.clearCookie("nexid_access_token", { httpOnly: true, secure, sameSite, domain, path: "/" });
    res.clearCookie("nexid_refresh_token", { httpOnly: true, secure, sameSite, domain, path: "/" });
  }

  private async registerFailedLogin(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { failedLoginCount: true }
    });
    if (!user) return;
    const nextFailed = user.failedLoginCount + 1;
    const lockoutUntil =
      nextFailed >= LOCKOUT_AFTER_FAILED ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: nextFailed,
        lockoutUntil
      }
    });
  }

  private assertRateLimit(key: string, limit: number, windowMs: number, message: string) {
    if (this.rateLimitExceeded(key, limit, windowMs)) {
      throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async assertParentOtpSendAllowed(mobile: string, ip: string | undefined, userAgent?: string) {
    const normalizedIp = ip || "unknown";
    const windowStart = new Date(Date.now() - OTP_WINDOW_MS);
    const [mobileCount, ipCount] = await Promise.all([
      this.prisma.otpChallenge.count({
        where: {
          mobile,
          createdAt: { gte: windowStart }
        }
      }),
      this.prisma.otpChallenge.count({
        where: {
          requestedIp: normalizedIp,
          createdAt: { gte: windowStart }
        }
      })
    ]);

    if (mobileCount >= OTP_SEND_LIMIT || ipCount >= OTP_SEND_LIMIT) {
      await this.audit({
        action: "OTP_SEND_RATE_LIMITED",
        entityId: this.otpAuditEntityId(mobile),
        ip: normalizedIp,
        userAgent,
        newValue: {
          mobileCount,
          ipCount
        }
      });
      throw new HttpException("Too many OTP requests. Try later.", HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async assertParentOtpVerifyAllowed(mobile: string, ip: string | undefined, userAgent?: string) {
    const normalizedIp = ip || "unknown";
    const windowStart = new Date(Date.now() - OTP_WINDOW_MS);
    const auditEntityId = this.otpAuditEntityId(mobile);
    const [mobileFailures, ipFailures] = await Promise.all([
      this.prisma.auditLog.count({
        where: {
          entityType: "AUTH",
          entityId: auditEntityId,
          action: { in: ["OTP_VERIFY_FAILED", "OTP_VERIFY_RATE_LIMITED"] },
          createdAt: { gte: windowStart }
        }
      }),
      this.prisma.auditLog.count({
        where: {
          entityType: "AUTH",
          action: { in: ["OTP_VERIFY_FAILED", "OTP_VERIFY_RATE_LIMITED"] },
          ipAddress: normalizedIp,
          createdAt: { gte: windowStart }
        }
      })
    ]);

    if (mobileFailures >= OTP_VERIFY_LIMIT || ipFailures >= OTP_VERIFY_LIMIT) {
      await this.audit({
        action: "OTP_VERIFY_RATE_LIMITED",
        entityId: auditEntityId,
        ip: normalizedIp,
        userAgent,
        newValue: {
          mobileFailures,
          ipFailures
        }
      });
      throw new HttpException("Too many OTP attempts. Try later.", HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private hash(input: string) {
    return createHash("sha256").update(input).digest("hex");
  }

  private otpAuditEntityId(mobile: string) {
    return `OTP:${this.hash(mobile).slice(0, 24)}`;
  }

  private buildParentMobileData(mobile: string) {
    const normalized = mobile.trim();
    return {
      mobile: this.dataProtectionService.maskPhone(normalized) || normalized,
      mobileHash: this.dataProtectionService.stableHash(normalized),
      mobileCiphertext: this.dataProtectionService.encryptText(normalized)
    };
  }

  private rateLimitExceeded(key: string, limit = OTP_SEND_LIMIT, windowMs = OTP_WINDOW_MS) {
    const now = Date.now();
    const history = (this.rateMap.get(key) ?? []).filter((ts) => now - ts < windowMs);
    history.push(now);
    this.rateMap.set(key, history);
    return history.length > limit;
  }

  private readCookie(req: Request, name: string) {
    const cookie = req.headers.cookie;
    if (!cookie) return null;
    const parts = cookie.split(";").map((chunk) => chunk.trim());
    const found = parts.find((entry) => entry.startsWith(`${name}=`));
    if (!found) return null;
    return decodeURIComponent(found.slice(name.length + 1));
  }

  private readDeviceId(req: Request) {
    const header = req.headers["x-device-id"];
    if (Array.isArray(header)) return header[0];
    return header || undefined;
  }

  private getIp(req: Request) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.length > 0) {
      return forwarded.split(",")[0].trim();
    }
    return req.ip;
  }

  private async audit(args: {
    actorUserId?: string;
    action: string;
    entityId: string;
    ip?: string;
    userAgent?: string;
    newValue?: Record<string, unknown>;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: args.actorUserId,
          entityType: "AUTH",
          entityId: args.entityId,
          action: args.action,
          newValue: (args.newValue ?? undefined) as Prisma.InputJsonValue | undefined,
          ipAddress: args.ip,
          userAgent: args.userAgent
        }
      });
    } catch (error) {
      this.logger.warn(`Audit write failed: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }
}
