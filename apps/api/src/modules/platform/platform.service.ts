import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AsyncJobStatus,
  AsyncJobType,
  IntakeSubmissionStage,
  OrderStatus,
  Prisma,
  Role as PrismaRole,
  StudentStatus
} from "@prisma/client";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import { createReadStream } from "fs";
import { stat, unlink } from "fs/promises";
import { basename, extname, join, resolve, sep } from "path";
import { AccessControlService } from "../../common/access/access-control.service";
import { AuthenticatedUser } from "../../common/auth/auth-user.type";
import {
  hasGlobalTenantAccess,
  isSalesRole,
  isSchoolRole,
  normalizeRole
} from "../../common/auth/role.utils";
import { Role } from "../../common/enums/role.enum";
import { PrismaService } from "../../prisma/prisma.service";
import { UpsertMaskPolicyDto } from "./dto/upsert-mask-policy.dto";
import { RevokeUserSessionsDto } from "./dto/revoke-user-sessions.dto";
import { CreateAsyncJobDto } from "./dto/create-async-job.dto";
import { ProcessAsyncJobDto } from "./dto/process-async-job.dto";
import { GenerateDigitalIdDto } from "./dto/generate-digital-id.dto";
import { ScanDigitalIdDto } from "./dto/scan-digital-id.dto";
import { CreateWorkflowRuleDto } from "./dto/create-workflow-rule.dto";
import { UpdateWorkflowRuleDto } from "./dto/update-workflow-rule.dto";
import { ApplyWorkflowRuleDto } from "./dto/apply-workflow-rule.dto";
import { SetTemplateColorProfileDto } from "./dto/set-template-color-profile.dto";
import { RetentionSummaryDto } from "./dto/retention-summary.dto";
import { PurgeRetentionDto } from "./dto/purge-retention.dto";

type EnterpriseReportQuery = {
  start?: string;
  end?: string;
  institutionType?: string;
  region?: string;
  schoolId?: string;
};

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControlService: AccessControlService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async listMaskPolicies(actor: AuthenticatedUser, schoolId?: string) {
    const scopedSchoolIds = this.resolveScopedSchoolIds(actor, schoolId);
    return this.prisma.fieldMaskPolicy.findMany({
      where: {
        ...(scopedSchoolIds ? { schoolId: { in: scopedSchoolIds } } : {})
      },
      orderBy: [{ schoolId: "asc" }, { fieldKey: "asc" }]
    });
  }

  async upsertMaskPolicy(actor: AuthenticatedUser, dto: UpsertMaskPolicyDto) {
    this.assertSecurityAdmin(actor);
    this.accessControlService.assertSchoolAccess(actor, dto.schoolId);
    const row = await this.prisma.fieldMaskPolicy.upsert({
      where: { schoolId_fieldKey: { schoolId: dto.schoolId, fieldKey: dto.fieldKey.trim() } },
      create: {
        schoolId: dto.schoolId,
        fieldKey: dto.fieldKey.trim(),
        rolesAllowed: dto.rolesAllowed.map((role) => role.trim().toUpperCase()),
        maskStrategy: dto.maskStrategy?.trim().toUpperCase() || "PARTIAL",
        isActive: dto.isActive ?? true
      },
      update: {
        rolesAllowed: dto.rolesAllowed.map((role) => role.trim().toUpperCase()),
        maskStrategy: dto.maskStrategy?.trim().toUpperCase() || "PARTIAL",
        isActive: dto.isActive ?? true
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "MASK_POLICY",
        entityId: row.id,
        action: "UPSERT",
        newValue: {
          schoolId: row.schoolId,
          fieldKey: row.fieldKey,
          rolesAllowed: row.rolesAllowed,
          maskStrategy: row.maskStrategy,
          isActive: row.isActive
        } as Prisma.InputJsonValue
      }
    });
    return row;
  }

  async getSignedAssetUrl(actor: AuthenticatedUser, photoKey: string | undefined, ttlSeconds = 600) {
    const normalizedKey = typeof photoKey === "string" ? photoKey.trim() : "";
    if (!normalizedKey) throw new BadRequestException("photoKey required");
    if (ttlSeconds < 60 || ttlSeconds > 3600 * 24) {
      throw new BadRequestException("ttlSeconds must be between 60 and 86400");
    }

    const student = await this.prisma.student.findFirst({
      where: { photoKey: normalizedKey, deletedAt: null },
      select: { id: true, schoolId: true }
    });
    if (!student) throw new NotFoundException("Photo asset not found");
    this.accessControlService.assertSchoolAccess(actor, student.schoolId);

    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const token = await this.jwtService.signAsync(
      {
        asset: normalizedKey,
        schoolId: student.schoolId,
        purpose: "ASSET_VIEW"
      },
      {
        secret: this.assetSecret(),
        expiresIn: `${ttlSeconds}s`
      }
    );
    const apiBase = this.configService.get("PUBLIC_API_BASE", "http://localhost:4000/api/v2");
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "ASSET",
        entityId: student.id,
        action: "SIGNED_URL_ISSUED",
        newValue: {
          kind: "PHOTO",
          schoolId: student.schoolId,
          ttlSeconds
        } as Prisma.InputJsonValue
      }
    });
    return {
      signedUrl: `${apiBase}/platform/security/assets/${token}`,
      token,
      expiresAt: expiresAt.toISOString()
    };
  }

  async resolveSignedAsset(actor: AuthenticatedUser, token: string, res: Response) {
    let payload: { asset: string; schoolId: string; purpose: string };
    try {
      payload = await this.jwtService.verifyAsync(token, { secret: this.assetSecret() });
    } catch {
      await this.auditAssetDenied(undefined, "TOKEN_INVALID", "ASSET");
      throw new ForbiddenException("Invalid or expired asset token");
    }
    if (payload.purpose !== "ASSET_VIEW") {
      await this.auditAssetDenied(actor.sub, "INVALID_PURPOSE", "ASSET", payload.asset);
      throw new ForbiddenException("Invalid asset token purpose");
    }
    try {
      this.accessControlService.assertSchoolAccess(actor, payload.schoolId);
    } catch (error) {
      await this.auditAssetDenied(actor.sub, "SCHOOL_SCOPE_DENIED", "ASSET", payload.asset, payload.schoolId);
      throw error;
    }
    const filePath = this.resolvePhotoAssetPath(payload.asset);
    await this.streamProtectedFile(res, filePath, basename(filePath), "inline");
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "ASSET",
        entityId: payload.asset,
        action: "ASSET_VIEW",
        newValue: {
          kind: "PHOTO",
          schoolId: payload.schoolId
        } as Prisma.InputJsonValue
      }
    });
  }

  async getSignedGeneratedArtifactUrl(
    actor: AuthenticatedUser,
    entityType: "PRINT_JOB" | "RENDER_BATCH",
    entityId: string,
    ttlSeconds = 600
  ) {
    this.assertCanAccessGeneratedArtifact(actor, entityType);
    if (ttlSeconds < 60 || ttlSeconds > 3600 * 24) {
      throw new BadRequestException("ttlSeconds must be between 60 and 86400");
    }

    const artifact = await this.lookupGeneratedArtifact(entityType, entityId);
    if (!artifact) {
      throw new NotFoundException("Generated artifact not found");
    }
    this.accessControlService.assertSchoolAccess(actor, artifact.schoolId);

    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const token = await this.jwtService.signAsync(
      {
        purpose: "ARTIFACT_DOWNLOAD",
        entityType,
        entityId,
        schoolId: artifact.schoolId
      },
      {
        secret: this.assetSecret(),
        expiresIn: `${ttlSeconds}s`
      }
    );

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType,
        entityId,
        action: "ARTIFACT_SIGNED_URL_ISSUED",
        newValue: {
          schoolId: artifact.schoolId,
          ttlSeconds
        } as Prisma.InputJsonValue
      }
    });

    const apiBase = this.configService.get("PUBLIC_API_BASE", "http://localhost:4000/api/v2");
    return {
      signedUrl: `${apiBase}/platform/security/generated-artifacts/${token}`,
      token,
      expiresAt: expiresAt.toISOString()
    };
  }

  async downloadGeneratedArtifact(actor: AuthenticatedUser, token: string, res: Response) {
    let payload: { entityType: "PRINT_JOB" | "RENDER_BATCH"; entityId: string; schoolId: string; purpose: string };
    try {
      payload = await this.jwtService.verifyAsync(token, { secret: this.assetSecret() });
    } catch {
      await this.auditAssetDenied(undefined, "TOKEN_INVALID", "ARTIFACT");
      throw new ForbiddenException("Invalid or expired artifact token");
    }

    if (payload.purpose !== "ARTIFACT_DOWNLOAD") {
      await this.auditAssetDenied(actor.sub, "INVALID_PURPOSE", payload.entityType, payload.entityId, payload.schoolId);
      throw new ForbiddenException("Invalid artifact token purpose");
    }
    try {
      this.assertCanAccessGeneratedArtifact(actor, payload.entityType);
    } catch (error) {
      await this.auditAssetDenied(actor.sub, "ROLE_DENIED", payload.entityType, payload.entityId, payload.schoolId);
      throw error;
    }

    const artifact = await this.lookupGeneratedArtifact(payload.entityType, payload.entityId);
    if (!artifact) {
      throw new NotFoundException("Generated artifact not found");
    }
    try {
      this.accessControlService.assertSchoolAccess(actor, artifact.schoolId);
    } catch (error) {
      await this.auditAssetDenied(actor.sub, "SCHOOL_SCOPE_DENIED", payload.entityType, payload.entityId, artifact.schoolId);
      throw error;
    }

    await this.streamProtectedFile(res, artifact.localPath, artifact.fileName, "attachment");
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: payload.entityType,
        entityId: payload.entityId,
        action: "ARTIFACT_DOWNLOADED",
        newValue: {
          schoolId: artifact.schoolId,
          fileName: artifact.fileName
        } as Prisma.InputJsonValue
      }
    });
  }

  async listAuthAnomalies(actor: AuthenticatedUser, limit = 100) {
    this.assertSecurityAdmin(actor);
    const rows = await this.prisma.auditLog.findMany({
      where: {
        entityType: "AUTH",
        action: { in: ["LOGIN_FAILED", "OTP_SENT", "OTP_LOGIN_SUCCESS", "PASSWORD_RESET_REQUESTED"] }
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 500),
      include: { actorUser: { select: { id: true, email: true, role: true } } }
    });

    const failCounts = new Map<string, number>();
    rows.forEach((row) => {
      if (row.action === "LOGIN_FAILED") {
        const key = row.ipAddress || "unknown";
        failCounts.set(key, (failCounts.get(key) || 0) + 1);
      }
    });

    return {
      recent: rows,
      hotIps: Array.from(failCounts.entries())
        .map(([ip, count]) => ({ ip, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    };
  }

  async listSecurityEvents(actor: AuthenticatedUser, limit = 100) {
    this.assertSecurityAdmin(actor);

    const rows = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          {
            entityType: "AUTH",
            action: {
              in: ["OTP_SEND_RATE_LIMITED", "OTP_VERIFY_RATE_LIMITED", "OTP_VERIFY_FAILED", "SESSIONS_REVOKED"]
            }
          },
          {
            action: {
              in: [
                "ACCESS_DENIED",
                "ARTIFACT_DOWNLOADED",
                "ARTIFACT_SIGNED_URL_ISSUED",
                "SIGNED_URL_ISSUED",
                "ASSET_VIEW",
                "EXPORT_SCHOOL_REPORT_CSV",
                "EXPORT_CSV",
                "PURGE_DRY_RUN",
                "PURGE_EXECUTED"
              ]
            }
          }
        ]
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 500),
      include: { actorUser: { select: { id: true, email: true, role: true } } }
    });

    const actionCounts = new Map<string, number>();
    rows.forEach((row) => {
      actionCounts.set(row.action, (actionCounts.get(row.action) || 0) + 1);
    });

    return {
      recent: rows,
      actionCounts: Array.from(actionCounts.entries())
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 12)
    };
  }

  async revokeUserSessions(actor: AuthenticatedUser, dto: RevokeUserSessionsDto) {
    this.assertSecurityAdmin(actor);
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user || user.deletedAt) throw new NotFoundException("User not found");

    const result = await this.prisma.authSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: "ADMIN_SECURITY_REVOKE" }
    });
    if (dto.revokeMfa) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { mfaEnabled: false }
      });
    }

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "AUTH",
        entityId: user.id,
        action: "SESSIONS_REVOKED",
        newValue: {
          revokedCount: result.count,
          revokeMfa: dto.revokeMfa ?? false
        } as Prisma.InputJsonValue
      }
    });
    return { userId: user.id, revokedSessions: result.count };
  }

  async getRetentionSummary(actor: AuthenticatedUser, query: RetentionSummaryDto) {
    this.assertSecurityAdmin(actor);
    const policy = this.resolveRetentionPolicy(query);
    const now = Date.now();

    const [
      otpExpired,
      otpConsumed,
      resetExpired,
      resetUsed,
      sessionsExpired,
      sessionsRevoked,
      renderBatchArtifacts,
      printJobArtifacts
    ] = await Promise.all([
      this.prisma.otpChallenge.count({
        where: {
          expiresAt: { lt: new Date(now - policy.otpRetentionHours * 60 * 60 * 1000) }
        }
      }),
      this.prisma.otpChallenge.count({
        where: {
          consumedAt: { lt: new Date(now - policy.otpRetentionHours * 60 * 60 * 1000) }
        }
      }),
      this.prisma.passwordResetToken.count({
        where: {
          expiresAt: { lt: new Date(now - policy.resetTokenRetentionHours * 60 * 60 * 1000) }
        }
      }),
      this.prisma.passwordResetToken.count({
        where: {
          usedAt: { lt: new Date(now - policy.resetTokenRetentionHours * 60 * 60 * 1000) }
        }
      }),
      this.prisma.authSession.count({
        where: {
          expiresAt: { lt: new Date(now - policy.sessionRetentionDays * 24 * 60 * 60 * 1000) }
        }
      }),
      this.prisma.authSession.count({
        where: {
          revokedAt: { lt: new Date(now - policy.sessionRetentionDays * 24 * 60 * 60 * 1000) }
        }
      }),
      this.prisma.renderBatch.findMany({
        where: {
          createdAt: { lt: new Date(now - policy.artifactRetentionDays * 24 * 60 * 60 * 1000) },
          artifactMetaJson: { not: Prisma.DbNull }
        },
        select: { id: true, schoolId: true, artifactMetaJson: true, artifactUrl: true }
      }),
      this.prisma.printJob.findMany({
        where: {
          createdAt: { lt: new Date(now - policy.artifactRetentionDays * 24 * 60 * 60 * 1000) },
          artifactMetaJson: { not: Prisma.DbNull }
        },
        select: { id: true, schoolId: true, artifactMetaJson: true, printFileUrl: true }
      })
    ]);

    const renderArtifactCandidates = this.collectArtifactCandidates(
      renderBatchArtifacts.map((row) => ({
        entityType: "RENDER_BATCH" as const,
        entityId: row.id,
        schoolId: row.schoolId,
        artifactMetaJson: row.artifactMetaJson
      }))
    );
    const printArtifactCandidates = this.collectArtifactCandidates(
      printJobArtifacts.map((row) => ({
        entityType: "PRINT_JOB" as const,
        entityId: row.id,
        schoolId: row.schoolId,
        artifactMetaJson: row.artifactMetaJson
      }))
    );

    return {
      policy,
      summary: {
        otpChallenges: {
          expired: otpExpired,
          consumed: otpConsumed
        },
        resetTokens: {
          expired: resetExpired,
          used: resetUsed
        },
        authSessions: {
          expired: sessionsExpired,
          revoked: sessionsRevoked
        },
        generatedArtifacts: {
          renderBatches: renderArtifactCandidates.length,
          printJobs: printArtifactCandidates.length,
          total: renderArtifactCandidates.length + printArtifactCandidates.length
        }
      }
    };
  }

  async purgeRetentionArtifacts(actor: AuthenticatedUser, dto: PurgeRetentionDto) {
    this.assertSecurityAdmin(actor);
    const policy = this.resolveRetentionPolicy(dto);
    const dryRun = dto.dryRun ?? true;
    const now = Date.now();

    const otpExpiryCutoff = new Date(now - policy.otpRetentionHours * 60 * 60 * 1000);
    const resetExpiryCutoff = new Date(now - policy.resetTokenRetentionHours * 60 * 60 * 1000);
    const sessionExpiryCutoff = new Date(now - policy.sessionRetentionDays * 24 * 60 * 60 * 1000);
    const artifactExpiryCutoff = new Date(now - policy.artifactRetentionDays * 24 * 60 * 60 * 1000);

    const [renderBatchRows, printJobRows] = await Promise.all([
      this.prisma.renderBatch.findMany({
        where: {
          createdAt: { lt: artifactExpiryCutoff },
          artifactMetaJson: { not: Prisma.DbNull }
        },
        select: { id: true, schoolId: true, artifactMetaJson: true, artifactUrl: true }
      }),
      this.prisma.printJob.findMany({
        where: {
          createdAt: { lt: artifactExpiryCutoff },
          artifactMetaJson: { not: Prisma.DbNull }
        },
        select: { id: true, schoolId: true, artifactMetaJson: true, printFileUrl: true }
      })
    ]);

    const renderArtifacts = this.collectArtifactCandidates(
      renderBatchRows.map((row) => ({
        entityType: "RENDER_BATCH" as const,
        entityId: row.id,
        schoolId: row.schoolId,
        artifactMetaJson: row.artifactMetaJson
      }))
    );
    const printArtifacts = this.collectArtifactCandidates(
      printJobRows.map((row) => ({
        entityType: "PRINT_JOB" as const,
        entityId: row.id,
        schoolId: row.schoolId,
        artifactMetaJson: row.artifactMetaJson
      }))
    );

    const counts = {
      otpChallenges: {
        expired: 0,
        consumed: 0
      },
      resetTokens: {
        expired: 0,
        used: 0
      },
      authSessions: {
        expired: 0,
        revoked: 0
      },
      generatedArtifacts: {
        renderBatches: renderArtifacts.length,
        printJobs: printArtifacts.length,
        filesDeleted: 0
      }
    };

    if (!dryRun) {
      const [otpExpiredRes, otpConsumedRes, resetExpiredRes, resetUsedRes, sessionsExpiredRes, sessionsRevokedRes] =
        await Promise.all([
          this.prisma.otpChallenge.deleteMany({
            where: {
              expiresAt: { lt: otpExpiryCutoff }
            }
          }),
          this.prisma.otpChallenge.deleteMany({
            where: {
              consumedAt: { lt: otpExpiryCutoff }
            }
          }),
          this.prisma.passwordResetToken.deleteMany({
            where: {
              expiresAt: { lt: resetExpiryCutoff }
            }
          }),
          this.prisma.passwordResetToken.deleteMany({
            where: {
              usedAt: { lt: resetExpiryCutoff }
            }
          }),
          this.prisma.authSession.deleteMany({
            where: {
              expiresAt: { lt: sessionExpiryCutoff }
            }
          }),
          this.prisma.authSession.deleteMany({
            where: {
              revokedAt: { lt: sessionExpiryCutoff }
            }
          })
        ]);

      counts.otpChallenges.expired = otpExpiredRes.count;
      counts.otpChallenges.consumed = otpConsumedRes.count;
      counts.resetTokens.expired = resetExpiredRes.count;
      counts.resetTokens.used = resetUsedRes.count;
      counts.authSessions.expired = sessionsExpiredRes.count;
      counts.authSessions.revoked = sessionsRevokedRes.count;

      const removedRenderFiles = await this.deleteArtifactFiles(renderArtifacts);
      const removedPrintFiles = await this.deleteArtifactFiles(printArtifacts);
      counts.generatedArtifacts.filesDeleted = removedRenderFiles + removedPrintFiles;

      if (renderArtifacts.length) {
        await this.prisma.$transaction(
          renderArtifacts.map((row) =>
            this.prisma.renderBatch.update({
              where: { id: row.entityId },
              data: {
                artifactUrl: null,
                artifactMetaJson: {
                  purgedAt: new Date().toISOString(),
                  retainedByPolicyDays: policy.artifactRetentionDays
                } as Prisma.InputJsonValue
              }
            })
          )
        );
      }

      if (printArtifacts.length) {
        await this.prisma.$transaction(
          printArtifacts.map((row) =>
            this.prisma.printJob.update({
              where: { id: row.entityId },
              data: {
                printFileUrl: null,
                artifactMetaJson: {
                  purgedAt: new Date().toISOString(),
                  retainedByPolicyDays: policy.artifactRetentionDays
                } as Prisma.InputJsonValue
              }
            })
          )
        );
      }
    } else {
      counts.otpChallenges.expired = await this.prisma.otpChallenge.count({
        where: {
          expiresAt: { lt: otpExpiryCutoff }
        }
      });
      counts.otpChallenges.consumed = await this.prisma.otpChallenge.count({
        where: {
          consumedAt: { lt: otpExpiryCutoff }
        }
      });
      counts.resetTokens.expired = await this.prisma.passwordResetToken.count({
        where: {
          expiresAt: { lt: resetExpiryCutoff }
        }
      });
      counts.resetTokens.used = await this.prisma.passwordResetToken.count({
        where: {
          usedAt: { lt: resetExpiryCutoff }
        }
      });
      counts.authSessions.expired = await this.prisma.authSession.count({
        where: {
          expiresAt: { lt: sessionExpiryCutoff }
        }
      });
      counts.authSessions.revoked = await this.prisma.authSession.count({
        where: {
          revokedAt: { lt: sessionExpiryCutoff }
        }
      });
    }

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "SECURITY_RETENTION",
        entityId: "GLOBAL",
        action: dryRun ? "PURGE_DRY_RUN" : "PURGE_EXECUTED",
        newValue: {
          policy,
          counts
        } as Prisma.InputJsonValue
      }
    });

    return {
      dryRun,
      policy,
      counts
    };
  }

  async createAsyncJob(actor: AuthenticatedUser, dto: CreateAsyncJobDto) {
    if (dto.schoolId) this.accessControlService.assertSchoolAccess(actor, dto.schoolId);
    const job = await this.prisma.asyncJob.create({
      data: {
        schoolId: dto.schoolId || null,
        type: dto.type,
        status: AsyncJobStatus.QUEUED,
        payloadJson: (dto.payload || undefined) as Prisma.InputJsonValue | undefined,
        createdById: actor.sub
      }
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "ASYNC_JOB",
        entityId: job.id,
        action: "CREATE",
        newValue: {
          type: job.type,
          schoolId: job.schoolId
        } as Prisma.InputJsonValue
      }
    });
    return job;
  }

  async listAsyncJobs(actor: AuthenticatedUser, schoolId?: string, status?: AsyncJobStatus, type?: AsyncJobType) {
    const scopedSchoolIds = this.resolveScopedSchoolIds(actor, schoolId);
    return this.prisma.asyncJob.findMany({
      where: {
        ...(scopedSchoolIds ? { schoolId: { in: scopedSchoolIds } } : {}),
        ...(status ? { status } : {}),
        ...(type ? { type } : {})
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200
    });
  }

  async processAsyncJob(actor: AuthenticatedUser, jobId: string, dto: ProcessAsyncJobDto) {
    this.assertSecurityAdmin(actor);
    const job = await this.prisma.asyncJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException("Async job not found");
    if (job.schoolId) this.accessControlService.assertSchoolAccess(actor, job.schoolId);
    const runnableStatuses: AsyncJobStatus[] = [AsyncJobStatus.QUEUED, AsyncJobStatus.FAILED];
    if (!dto.force && !runnableStatuses.includes(job.status)) {
      throw new BadRequestException("Job is not runnable in current status");
    }

    const startedAt = new Date();
    await this.prisma.asyncJob.update({
      where: { id: job.id },
      data: {
        status: AsyncJobStatus.PROCESSING,
        startedAt,
        attempts: { increment: 1 },
        errorMessage: null
      }
    });

    try {
      const resultJson = await this.executeAsyncJob(job);
      const finished = await this.prisma.asyncJob.update({
        where: { id: job.id },
        data: {
          status: AsyncJobStatus.COMPLETED,
          finishedAt: new Date(),
          resultJson: resultJson as Prisma.InputJsonValue
        }
      });
      await this.prisma.auditLog.create({
        data: {
          actorUserId: actor.sub,
          entityType: "ASYNC_JOB",
          entityId: job.id,
          action: "PROCESS_COMPLETED"
        }
      });
      return finished;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Job failed";
      const failed = await this.prisma.asyncJob.update({
        where: { id: job.id },
        data: {
          status: AsyncJobStatus.FAILED,
          finishedAt: new Date(),
          errorMessage: message
        }
      });
      await this.prisma.auditLog.create({
        data: {
          actorUserId: actor.sub,
          entityType: "ASYNC_JOB",
          entityId: job.id,
          action: "PROCESS_FAILED",
          newValue: { error: message } as Prisma.InputJsonValue
        }
      });
      return failed;
    }
  }

  async enterpriseReport(actor: AuthenticatedUser, query: EnterpriseReportQuery) {
    const scopedSchoolIds = this.resolveScopedSchoolIds(actor, query.schoolId);
    const schoolWhere: Prisma.SchoolWhereInput = {
      deletedAt: null,
      ...(scopedSchoolIds ? { id: { in: scopedSchoolIds } } : {}),
      ...(query.institutionType ? { institutionType: query.institutionType as any } : {}),
      ...(query.region ? { OR: [{ city: { contains: query.region, mode: "insensitive" } }, { state: { contains: query.region, mode: "insensitive" } }] } : {})
    };
    const schools = await this.prisma.school.findMany({
      where: schoolWhere,
      select: { id: true, code: true, name: true, institutionType: true, city: true, state: true }
    });
    const schoolIds = schools.map((school) => school.id);
    if (!schoolIds.length) return { rows: [], totals: { schools: 0, students: 0, invoices: 0, printJobs: 0, scans: 0 } };

    const dateFilter = this.parseDateRange(query.start, query.end);
    const [studentAgg, invoiceAgg, printAgg, scanAgg] = await Promise.all([
      this.prisma.student.groupBy({
        by: ["schoolId"],
        where: { schoolId: { in: schoolIds }, ...(dateFilter ? { createdAt: dateFilter } : {}) },
        _count: { _all: true }
      }),
      this.prisma.invoice.groupBy({
        by: ["schoolId"],
        where: { schoolId: { in: schoolIds }, ...(dateFilter ? { issuedAt: dateFilter } : {}) },
        _count: { _all: true },
        _sum: { totalAmount: true, amountPaid: true }
      }),
      this.prisma.printJob.groupBy({
        by: ["schoolId"],
        where: { schoolId: { in: schoolIds }, ...(dateFilter ? { createdAt: dateFilter } : {}) },
        _count: { _all: true }
      }),
      this.prisma.qrScanEvent.groupBy({
        by: ["schoolId"],
        where: { schoolId: { in: schoolIds }, ...(dateFilter ? { createdAt: dateFilter } : {}) },
        _count: { _all: true }
      })
    ]);

    const studentsBySchool = new Map(studentAgg.map((row) => [row.schoolId, row._count._all]));
    const invoicesBySchool = new Map(
      invoiceAgg.map((row) => [
        row.schoolId,
        {
          count: row._count._all,
          total: Number(row._sum.totalAmount || 0),
          paid: Number(row._sum.amountPaid || 0)
        }
      ])
    );
    const printBySchool = new Map(printAgg.map((row) => [row.schoolId, row._count._all]));
    const scansBySchool = new Map(scanAgg.map((row) => [row.schoolId, row._count._all]));

    const rows = schools.map((school) => {
      const inv = invoicesBySchool.get(school.id) || { count: 0, total: 0, paid: 0 };
      return {
        schoolId: school.id,
        schoolCode: school.code,
        schoolName: school.name,
        institutionType: school.institutionType,
        region: `${school.city || ""}${school.state ? `, ${school.state}` : ""}`.replace(/^,\s*/, ""),
        students: studentsBySchool.get(school.id) || 0,
        invoices: inv.count,
        invoiced: this.round2(inv.total),
        collected: this.round2(inv.paid),
        outstanding: this.round2(Math.max(inv.total - inv.paid, 0)),
        printJobs: printBySchool.get(school.id) || 0,
        scans: scansBySchool.get(school.id) || 0
      };
    });

    return {
      rows,
      totals: {
        schools: rows.length,
        students: rows.reduce((acc, row) => acc + row.students, 0),
        invoices: rows.reduce((acc, row) => acc + row.invoices, 0),
        printJobs: rows.reduce((acc, row) => acc + row.printJobs, 0),
        scans: rows.reduce((acc, row) => acc + row.scans, 0),
        invoiced: this.round2(rows.reduce((acc, row) => acc + row.invoiced, 0)),
        collected: this.round2(rows.reduce((acc, row) => acc + row.collected, 0)),
        outstanding: this.round2(rows.reduce((acc, row) => acc + row.outstanding, 0))
      }
    };
  }

  async generateDigitalId(actor: AuthenticatedUser, dto: GenerateDigitalIdDto) {
    const student = await this.prisma.student.findUnique({
      where: { id: dto.studentId },
      include: { school: { select: { id: true, name: true, code: true } } }
    });
    if (!student || student.deletedAt) throw new NotFoundException("Student not found");
    this.accessControlService.assertSchoolAccess(actor, student.schoolId);

    const ttlHours = dto.ttlHours || 720;
    const token = await this.jwtService.signAsync(
      {
        kind: "DIGITAL_ID",
        studentId: student.id,
        schoolId: student.schoolId
      },
      {
        secret: this.digitalIdSecret(),
        expiresIn: `${ttlHours}h`
      }
    );
    const webBase = this.configService.get("WEB_BASE_URL", "http://localhost:3000");
    return {
      student: {
        id: student.id,
        fullName: student.fullName,
        className: student.className,
        section: student.section,
        rollNumber: student.rollNumber,
        photoKey: student.photoKey
      },
      school: student.school,
      token,
      qrUrl: `${webBase}/parent/portal?digital_token=${encodeURIComponent(token)}`,
      expiresInHours: ttlHours
    };
  }

  async verifyDigitalId(actor: AuthenticatedUser, token: string) {
    const payload = await this.verifyDigitalToken(token);
    this.accessControlService.assertSchoolAccess(actor, payload.schoolId);
    const student = await this.prisma.student.findUnique({
      where: { id: payload.studentId },
      select: {
        id: true,
        schoolId: true,
        fullName: true,
        className: true,
        section: true,
        rollNumber: true,
        status: true,
        intakeStage: true,
        photoKey: true
      }
    });
    if (!student) throw new NotFoundException("Student not found");
    return { student };
  }

  async scanDigitalId(actor: AuthenticatedUser, dto: ScanDigitalIdDto) {
    const payload = await this.verifyDigitalToken(dto.token);
    this.accessControlService.assertSchoolAccess(actor, payload.schoolId);

    const student = await this.prisma.student.findUnique({
      where: { id: payload.studentId },
      select: {
        id: true,
        schoolId: true,
        fullName: true,
        className: true,
        section: true,
        rollNumber: true,
        status: true,
        intakeStage: true
      }
    });
    if (!student) throw new NotFoundException("Student not found");

    const event = await this.prisma.qrScanEvent.create({
      data: {
        schoolId: student.schoolId,
        studentId: student.id,
        scannerUserId: dto.scannerUserId || actor.sub,
        scannerRole: dto.scannerRole.trim().toUpperCase(),
        location: dto.location?.trim() || null,
        metaJson: (dto.meta || undefined) as Prisma.InputJsonValue | undefined
      }
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "QR_SCAN",
        entityId: event.id,
        action: "DIGITAL_ID_SCANNED",
        newValue: {
          studentId: student.id,
          scannerRole: event.scannerRole,
          location: event.location
        } as Prisma.InputJsonValue
      }
    });
    return { student, event };
  }

  async listWorkflowRules(actor: AuthenticatedUser, schoolId?: string) {
    const scopedSchoolIds = this.resolveScopedSchoolIds(actor, schoolId);
    return this.prisma.workflowAutomationRule.findMany({
      where: {
        ...(scopedSchoolIds ? { schoolId: { in: scopedSchoolIds } } : {})
      },
      orderBy: [{ schoolId: "asc" }, { priority: "asc" }, { createdAt: "asc" }]
    });
  }

  async createWorkflowRule(actor: AuthenticatedUser, dto: CreateWorkflowRuleDto) {
    this.accessControlService.assertSchoolAccess(actor, dto.schoolId);
    const row = await this.prisma.workflowAutomationRule.create({
      data: {
        schoolId: dto.schoolId,
        name: dto.name.trim(),
        triggerStage: dto.triggerStage,
        actionType: dto.actionType.trim().toUpperCase(),
        conditionJson: (dto.condition || undefined) as Prisma.InputJsonValue | undefined,
        actionConfigJson: (dto.actionConfig || undefined) as Prisma.InputJsonValue | undefined,
        isActive: dto.isActive ?? true,
        priority: dto.priority || 100,
        createdById: actor.sub
      }
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "WORKFLOW_RULE",
        entityId: row.id,
        action: "CREATE"
      }
    });
    return row;
  }

  async updateWorkflowRule(actor: AuthenticatedUser, ruleId: string, dto: UpdateWorkflowRuleDto) {
    const existing = await this.prisma.workflowAutomationRule.findUnique({ where: { id: ruleId } });
    if (!existing) throw new NotFoundException("Workflow rule not found");
    this.accessControlService.assertSchoolAccess(actor, existing.schoolId);

    const updated = await this.prisma.workflowAutomationRule.update({
      where: { id: existing.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.triggerStage !== undefined ? { triggerStage: dto.triggerStage } : {}),
        ...(dto.actionType !== undefined ? { actionType: dto.actionType.trim().toUpperCase() } : {}),
        ...(dto.condition !== undefined ? { conditionJson: dto.condition as Prisma.InputJsonValue } : {}),
        ...(dto.actionConfig !== undefined ? { actionConfigJson: dto.actionConfig as Prisma.InputJsonValue } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {})
      }
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "WORKFLOW_RULE",
        entityId: updated.id,
        action: "UPDATE",
        oldValue: JSON.parse(JSON.stringify(existing)),
        newValue: JSON.parse(JSON.stringify(updated))
      }
    });
    return updated;
  }

  async applyWorkflowRule(actor: AuthenticatedUser, ruleId: string, dto: ApplyWorkflowRuleDto) {
    const [rule, student] = await Promise.all([
      this.prisma.workflowAutomationRule.findUnique({ where: { id: ruleId } }),
      this.prisma.student.findUnique({ where: { id: dto.studentId } })
    ]);
    if (!rule) throw new NotFoundException("Workflow rule not found");
    if (!student || student.deletedAt) throw new NotFoundException("Student not found");
    if (rule.schoolId !== student.schoolId) throw new BadRequestException("Rule and student school mismatch");
    this.accessControlService.assertSchoolAccess(actor, student.schoolId);

    const actionType = rule.actionType.toUpperCase();
    const actionConfig = (rule.actionConfigJson as Record<string, unknown> | null) || {};
    let updated: any = student;

    if (actionType === "HANDOFF_STAGE") {
      const stage = String(actionConfig.toStage || "").toUpperCase();
      if (!(stage in IntakeSubmissionStage)) {
        throw new BadRequestException("Invalid toStage in actionConfig");
      }
      const mappedStatus: StudentStatus =
        stage === IntakeSubmissionStage.APPROVED_FOR_PRINT
          ? StudentStatus.SALES_APPROVED
          : stage === IntakeSubmissionStage.APPROVED_FOR_DESIGN
            ? StudentStatus.SCHOOL_APPROVED
            : stage === IntakeSubmissionStage.PRINTED
              ? StudentStatus.PRINTED
              : stage === IntakeSubmissionStage.DISPATCHED || stage === IntakeSubmissionStage.ISSUED
                ? StudentStatus.DELIVERED
                : student.status;
      updated = await this.prisma.student.update({
        where: { id: student.id },
        data: {
          intakeStage: stage as IntakeSubmissionStage,
          status: mappedStatus
        }
      });
    } else if (actionType === "SET_STATUS") {
      const status = String(actionConfig.status || "").toUpperCase();
      if (!(status in StudentStatus)) {
        throw new BadRequestException("Invalid status in actionConfig");
      }
      updated = await this.prisma.student.update({
        where: { id: student.id },
        data: { status: status as StudentStatus }
      });
    } else if (actionType === "MARK_ON_HOLD") {
      updated = await this.prisma.student.update({
        where: { id: student.id },
        data: { intakeStage: IntakeSubmissionStage.ON_HOLD }
      });
    } else {
      throw new BadRequestException("Unsupported workflow rule actionType");
    }

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "WORKFLOW_RULE",
        entityId: rule.id,
        action: "APPLY",
        newValue: {
          studentId: student.id,
          actionType
        } as Prisma.InputJsonValue
      }
    });
    return { ruleId: rule.id, student: updated };
  }

  async setTemplateColorProfile(actor: AuthenticatedUser, dto: SetTemplateColorProfileDto) {
    const template = await this.prisma.template.findUnique({ where: { id: dto.templateId } });
    if (!template || template.deletedAt) throw new NotFoundException("Template not found");
    this.accessControlService.assertSchoolAccess(actor, template.schoolId);
    const mapping = ((template.mappingJson as Record<string, unknown>) || {}) as Record<string, unknown>;
    const printProfile = {
      colorProfile: dto.colorProfile || "CMYK_GENERIC",
      softProofEnabled: dto.softProofEnabled ?? true,
      warningTolerance: dto.warningTolerance || "MEDIUM",
      updatedAt: new Date().toISOString()
    };
    const updatedMapping = {
      ...mapping,
      __printProfile: printProfile
    };
    const updated = await this.prisma.template.update({
      where: { id: template.id },
      data: {
        mappingJson: updatedMapping as Prisma.InputJsonValue
      }
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        entityType: "TEMPLATE",
        entityId: template.id,
        action: "SET_COLOR_PROFILE",
        newValue: printProfile as Prisma.InputJsonValue
      }
    });
    return {
      templateId: updated.id,
      schoolId: updated.schoolId,
      printProfile
    };
  }

  private async executeAsyncJob(job: { id: string; type: AsyncJobType; payloadJson: Prisma.JsonValue | null; schoolId: string | null }) {
    const payload = (job.payloadJson as Record<string, unknown> | null) || {};
    if (job.type === AsyncJobType.PHOTO_ANALYZE) {
      return {
        normalized: true,
        qualityScore: 0.92,
        warnings: []
      };
    }
    if (job.type === AsyncJobType.TEMPLATE_REBIND) {
      const templateId = String(payload.templateId || "");
      if (!templateId) throw new BadRequestException("templateId required in payload");
      const affected = await this.prisma.proof.count({ where: { templateId } });
      return { templateId, affectedProofs: affected };
    }
    if (job.type === AsyncJobType.REPORT_EXPORT) {
      const schoolId = job.schoolId || String(payload.schoolId || "");
      const students = await this.prisma.student.count({ where: schoolId ? { schoolId } : {} });
      const invoices = await this.prisma.invoice.count({ where: schoolId ? { schoolId } : {} });
      return { schoolId: schoolId || null, students, invoices };
    }
    if (job.type === AsyncJobType.DIGITAL_ID_BULK) {
      const schoolId = job.schoolId || String(payload.schoolId || "");
      if (!schoolId) throw new BadRequestException("schoolId required");
      const count = await this.prisma.student.count({ where: { schoolId, deletedAt: null } });
      return { schoolId, generatedCount: count };
    }
    throw new BadRequestException("Unsupported async job type");
  }

  private async verifyDigitalToken(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync(token, { secret: this.digitalIdSecret() });
      if (payload.kind !== "DIGITAL_ID" || !payload.studentId || !payload.schoolId) {
        throw new ForbiddenException("Invalid digital id token");
      }
      return payload as { kind: string; studentId: string; schoolId: string };
    } catch {
      throw new ForbiddenException("Invalid or expired digital id token");
    }
  }

  private resolveScopedSchoolIds(actor: AuthenticatedUser, requestedSchoolId?: string): string[] | undefined {
    if (requestedSchoolId) {
      this.accessControlService.assertSchoolAccess(actor, requestedSchoolId);
      return [requestedSchoolId];
    }
    if (hasGlobalTenantAccess(actor.normalizedRole)) return undefined;
    if (isSchoolRole(actor.normalizedRole)) {
      if (!actor.schoolId) throw new ForbiddenException("School scope missing");
      return [actor.schoolId];
    }
    if (isSalesRole(actor.normalizedRole)) {
      return actor.assignedSchoolIds.length ? actor.assignedSchoolIds : ["__none__"];
    }
    throw new ForbiddenException("No school scope available");
  }

  private assertSecurityAdmin(actor: AuthenticatedUser) {
    const role = normalizeRole(actor.normalizedRole);
    if (![Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.OPERATIONS_ADMIN, Role.HR_ADMIN].includes(role as Role)) {
      throw new ForbiddenException("Security admin access required");
    }
  }

  private parseDateRange(start?: string, end?: string): Prisma.DateTimeFilter | undefined {
    if (!start && !end) return undefined;
    const out: Prisma.DateTimeFilter = {};
    if (start) out.gte = new Date(start);
    if (end) {
      const d = new Date(end);
      d.setHours(23, 59, 59, 999);
      out.lte = d;
    }
    return out;
  }

  private assetSecret() {
    return (
      this.configService.get<string>("ASSET_SIGNING_SECRET")?.trim() ||
      this.configService.getOrThrow<string>("JWT_ACCESS_SECRET")
    );
  }

  private digitalIdSecret() {
    return (
      this.configService.get<string>("DIGITAL_ID_SECRET")?.trim() ||
      this.configService.getOrThrow<string>("JWT_ACCESS_SECRET")
    );
  }

  private assertCanAccessGeneratedArtifact(
    actor: AuthenticatedUser,
    entityType: "PRINT_JOB" | "RENDER_BATCH"
  ) {
    const role = normalizeRole(actor.normalizedRole);
    if (hasGlobalTenantAccess(role)) {
      return;
    }

    if (entityType === "PRINT_JOB") {
      if (role === Role.PRINTING || role === Role.PRINT_OPS || role === Role.SCHOOL_ADMIN) {
        return;
      }
      throw new ForbiddenException("Not allowed to access protected print artifacts");
    }

    if (isSalesRole(role) || role === Role.PRINTING || role === Role.PRINT_OPS || role === Role.SCHOOL_ADMIN) {
      return;
    }

    throw new ForbiddenException("Not allowed to access protected render artifacts");
  }

  private resolveRetentionPolicy(input: {
    otpRetentionHours?: number;
    resetTokenRetentionHours?: number;
    sessionRetentionDays?: number;
    artifactRetentionDays?: number;
  }) {
    return {
      otpRetentionHours: input.otpRetentionHours ?? 24,
      resetTokenRetentionHours: input.resetTokenRetentionHours ?? 24,
      sessionRetentionDays: input.sessionRetentionDays ?? 30,
      artifactRetentionDays: input.artifactRetentionDays ?? 14
    };
  }

  private round2(v: number) {
    return Number(v.toFixed(2));
  }

  private resolvePhotoAssetPath(photoKey: string) {
    const normalized = photoKey.trim();
    if (!normalized.startsWith("local://")) {
      throw new ForbiddenException("Unsupported asset storage scheme");
    }

    const relativePath = normalized.slice("local://".length).replace(/^\/+/, "");
    const root = resolve(this.configService.get("LOCAL_UPLOAD_DIR", join(process.cwd(), "uploads")));
    const target = resolve(root, relativePath);
    this.assertPathWithinRoot(root, target);
    return target;
  }

  private async lookupGeneratedArtifact(entityType: "PRINT_JOB" | "RENDER_BATCH", entityId: string) {
    if (entityType === "PRINT_JOB") {
      const printJob = await this.prisma.printJob.findUnique({
        where: { id: entityId },
        select: { id: true, schoolId: true, artifactMetaJson: true, printFileUrl: true }
      });
      if (!printJob) return null;
      const localPath = this.readArtifactLocalPath(printJob.artifactMetaJson);
      if (!localPath) return null;
      return {
        schoolId: printJob.schoolId,
        localPath: this.resolveGeneratedArtifactPath(localPath),
        fileName: basename(localPath)
      };
    }

    const batch = await this.prisma.renderBatch.findUnique({
      where: { id: entityId },
      select: { id: true, schoolId: true, artifactMetaJson: true, artifactUrl: true }
    });
    if (!batch) return null;
    const localPath = this.readArtifactLocalPath(batch.artifactMetaJson);
    if (!localPath) return null;
    return {
      schoolId: batch.schoolId,
      localPath: this.resolveGeneratedArtifactPath(localPath),
      fileName: basename(localPath)
    };
  }

  private readArtifactLocalPath(value: Prisma.JsonValue | null) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const localPath = (value as Record<string, unknown>).localPath;
    return typeof localPath === "string" && localPath.trim() ? localPath.trim() : null;
  }

  private resolveGeneratedArtifactPath(localPath: string) {
    const root = resolve(join(process.cwd(), ".generated"));
    const target = resolve(localPath);
    this.assertPathWithinRoot(root, target);
    return target;
  }

  private assertPathWithinRoot(root: string, target: string) {
    const normalizedRoot = root.endsWith(sep) ? root : `${root}${sep}`;
    if (target !== root && !target.startsWith(normalizedRoot)) {
      throw new ForbiddenException("Protected asset path rejected");
    }
  }

  private async streamProtectedFile(
    res: Response,
    filePath: string,
    fileName: string,
    disposition: "inline" | "attachment"
  ) {
    const info = await stat(filePath).catch(() => null);
    if (!info || !info.isFile()) {
      throw new NotFoundException("Protected file not found");
    }

    res.setHeader("Content-Type", this.detectMimeType(fileName));
    res.setHeader("Content-Length", info.size.toString());
    res.setHeader("Content-Disposition", `${disposition}; filename=\"${fileName}\"`);
    res.setHeader("Cache-Control", "private, no-store, max-age=0");

    await new Promise<void>((resolvePromise, rejectPromise) => {
      const stream = createReadStream(filePath);
      stream.on("error", rejectPromise);
      res.on("close", resolvePromise);
      res.on("finish", resolvePromise);
      stream.pipe(res);
    });
  }

  private detectMimeType(fileName: string) {
    const ext = extname(fileName).toLowerCase();
    if (ext === ".pdf") return "application/pdf";
    if (ext === ".csv") return "text/csv; charset=utf-8";
    if (ext === ".json") return "application/json; charset=utf-8";
    if (ext === ".png") return "image/png";
    if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
    if (ext === ".webp") return "image/webp";
    return "application/octet-stream";
  }

  private collectArtifactCandidates(
    rows: Array<{
      entityType: "PRINT_JOB" | "RENDER_BATCH";
      entityId: string;
      schoolId: string;
      artifactMetaJson: Prisma.JsonValue | null;
    }>
  ) {
    return rows
      .map((row) => {
        const localPath = this.readArtifactLocalPath(row.artifactMetaJson);
        if (!localPath) return null;
        return {
          entityType: row.entityType,
          entityId: row.entityId,
          schoolId: row.schoolId,
          localPath: this.resolveGeneratedArtifactPath(localPath)
        };
      })
      .filter((row): row is { entityType: "PRINT_JOB" | "RENDER_BATCH"; entityId: string; schoolId: string; localPath: string } => !!row);
  }

  private async deleteArtifactFiles(
    rows: Array<{ entityType: "PRINT_JOB" | "RENDER_BATCH"; entityId: string; schoolId: string; localPath: string }>
  ) {
    let deleted = 0;
    for (const row of rows) {
      try {
        await unlink(row.localPath);
        deleted += 1;
      } catch {
        continue;
      }
    }
    return deleted;
  }

  private async auditAssetDenied(
    actorUserId: string | undefined,
    reason: string,
    entityType: string,
    entityId = "UNKNOWN",
    schoolId?: string
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId,
          entityType,
          entityId,
          action: "ACCESS_DENIED",
          newValue: {
            reason,
            schoolId: schoolId || null
          } as Prisma.InputJsonValue
        }
      });
    } catch {
      return;
    }
  }
}
