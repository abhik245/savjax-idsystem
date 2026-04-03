import * as assert from "node:assert/strict";
import { ConfigService } from "@nestjs/config";
import { AccessControlService } from "../src/common/access/access-control.service";
import { AuthService } from "../src/modules/auth/auth.service";
import { PlatformService } from "../src/modules/platform/platform.service";
import { AdminService } from "../src/modules/admin/admin.service";
import { SchoolsService } from "../src/modules/schools/schools.service";
import { Role } from "../src/common/enums/role.enum";
import { DataProtectionService } from "../src/common/services/data-protection.service";
import { ForbiddenException, HttpException, HttpStatus } from "@nestjs/common";
import { getPermissionsForRole } from "../src/common/auth/permission-matrix";
import { hasGlobalTenantAccess, normalizeRole } from "../src/common/auth/role.utils";
import { validateEnvConfig } from "../src/config/env.validation";

function runDataProtectionChecks() {
  const service = new DataProtectionService(
    new ConfigService({
      NODE_ENV: "test",
      FIELD_ENCRYPTION_KEY: "security-smoke-test-key"
    })
  );

  const redactedCamel = service.redactForLogs({
    parentMobile: "9000000001",
    parentName: "Abhik",
    address: "Plot 10, Shivdarshan, Pune",
    photoKey: "local://photos/student.png",
    token: "raw-token"
  }) as Record<string, string>;

  assert.equal(redactedCamel.parentMobile, "******0001");
  assert.equal(redactedCamel.parentName, "A***k");
  assert.equal(redactedCamel.photoKey, "[REDACTED_PHOTO_KEY]");
  assert.equal(redactedCamel.token, "[REDACTED_TOKEN]");
  assert.notEqual(redactedCamel.address, "Plot 10, Shivdarshan, Pune");

  const redactedSnake = service.redactForLogs({
    parent_mobile: "9000000001",
    principal_email: "principal@school.com",
    payload_json: "{\"name\":\"student\"}"
  }) as Record<string, string>;

  assert.equal(redactedSnake.parent_mobile, "******0001");
  assert.match(redactedSnake.principal_email, /^pr\*+@school\.com$/);
  assert.equal(redactedSnake.payload_json, "[REDACTED]");

  const payload = {
    student: "Demo Student",
    parentMobile: "9000000001",
    nested: { bloodGroup: "O+" }
  };
  const encrypted = service.encryptJson(payload);
  assert.ok(encrypted);
  assert.deepEqual(service.decryptJson(encrypted), payload);

  const encryptedText = service.encryptText("9000000001");
  assert.ok(encryptedText);
  assert.equal(service.decryptText(encryptedText), "9000000001");
  assert.equal(service.decryptText(null, "fallback"), "fallback");

  const stableHashA = service.stableHash("9000000001");
  const stableHashB = service.stableHash("9000000001");
  const stableHashC = service.stableHash("9000000002");
  assert.ok(stableHashA);
  assert.equal(stableHashA, stableHashB);
  assert.notEqual(stableHashA, stableHashC);
}

function runTenantScopeChecks() {
  const service = new AccessControlService({} as never);

  const superAdmin = {
    normalizedRole: Role.SUPER_ADMIN,
    schoolId: undefined,
    assignedSchoolIds: []
  };
  const sales = {
    normalizedRole: Role.SALES_PERSON,
    schoolId: undefined,
    assignedSchoolIds: ["school-1", "school-2"]
  };
  const schoolAdmin = {
    normalizedRole: Role.SCHOOL_ADMIN,
    schoolId: "school-1",
    assignedSchoolIds: ["school-1"]
  };

  assert.equal(service.canAccessSchool(superAdmin, "school-9"), true);
  assert.equal(service.canAccessSchool(sales, "school-1"), true);
  assert.equal(service.canAccessSchool(sales, "school-9"), false);
  assert.equal(service.canAccessSchool(schoolAdmin, "school-1"), true);
  assert.equal(service.canAccessSchool(schoolAdmin, "school-2"), false);

  assert.throws(
    () => service.assertSchoolAccess(sales, "school-9"),
    /Access denied for the requested school/
  );
  assert.throws(
    () => service.assertSchoolAccess(schoolAdmin, "school-2"),
    /Access denied for the requested school/
  );
}

function runRoleAliasChecks() {
  assert.equal(normalizeRole(Role.OPERATIONS_ADMIN), Role.COMPANY_ADMIN);
  assert.equal(normalizeRole(Role.SALES), Role.SALES_PERSON);
  assert.equal(hasGlobalTenantAccess(Role.OPERATIONS_ADMIN), true);
  assert.equal(hasGlobalTenantAccess(Role.SALES), false);

  const operationsPerms = getPermissionsForRole(Role.OPERATIONS_ADMIN);
  const companyPerms = getPermissionsForRole(Role.COMPANY_ADMIN);
  const salesAliasPerms = getPermissionsForRole(Role.SALES);
  const salesPerms = getPermissionsForRole(Role.SALES_PERSON);

  assert.deepEqual(operationsPerms, companyPerms);
  assert.deepEqual(salesAliasPerms, salesPerms);
}

function runOtpAuditIdentityChecks() {
  const authService = new AuthService(
    {} as never,
    {} as never,
    new ConfigService({
      NODE_ENV: "test"
    }),
    {} as never,
    new DataProtectionService(
      new ConfigService({
        NODE_ENV: "test",
        FIELD_ENCRYPTION_KEY: "security-smoke-test-key"
      })
    )
  );

  const auditIdA = (authService as any).otpAuditEntityId("9000000001");
  const auditIdB = (authService as any).otpAuditEntityId("9000000001");
  const auditIdC = (authService as any).otpAuditEntityId("9000000002");

  assert.equal(auditIdA, auditIdB);
  assert.notEqual(auditIdA, auditIdC);
  assert.ok(String(auditIdA).startsWith("OTP:"));
  assert.equal(String(auditIdA).includes("9000000001"), false);
}

function runEnvValidationChecks() {
  const devConfig = validateEnvConfig({
    NODE_ENV: "development",
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/nexid",
    JWT_ACCESS_SECRET: "replace_with_64_char_secret",
    FIELD_ENCRYPTION_KEY: "",
    CORS_ORIGIN: "http://localhost:3000",
    AUTH_COOKIE_SECURE: "false",
    AUTH_COOKIE_SAME_SITE: "lax",
    TRUST_PROXY: "false",
    PHOTO_MAX_MB: "40"
  });
  assert.equal(devConfig.NODE_ENV, "development");
  assert.equal(devConfig.CORS_ORIGIN, "http://localhost:3000");

  assert.throws(
    () =>
      validateEnvConfig({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://postgres:postgres@db:5432/nexid",
        JWT_ACCESS_SECRET: "replace_with_64_char_secret",
        FIELD_ENCRYPTION_KEY: "12345678901234567890123456789012",
        ASSET_SIGNING_SECRET: "12345678901234567890123456789012",
        DIGITAL_ID_SECRET: "12345678901234567890123456789012",
        CORS_ORIGIN: "https://app.savjax.com",
        AUTH_COOKIE_SECURE: "true",
        AUTH_COOKIE_SAME_SITE: "lax",
        TRUST_PROXY: "true",
        PHOTO_MAX_MB: "40"
      }),
    /JWT_ACCESS_SECRET must/
  );

  assert.throws(
    () =>
      validateEnvConfig({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://postgres:postgres@db:5432/nexid",
        JWT_ACCESS_SECRET: "12345678901234567890123456789012",
        FIELD_ENCRYPTION_KEY: "12345678901234567890123456789012",
        ASSET_SIGNING_SECRET: "12345678901234567890123456789012",
        DIGITAL_ID_SECRET: "12345678901234567890123456789012",
        CORS_ORIGIN: "https://app.savjax.com",
        AUTH_COOKIE_SECURE: "false",
        AUTH_COOKIE_SAME_SITE: "lax",
        TRUST_PROXY: "true",
        PHOTO_MAX_MB: "40"
      }),
    /AUTH_COOKIE_SECURE must be true in production/
  );

  assert.throws(
    () =>
      validateEnvConfig({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://postgres:postgres@db:5432/nexid",
        JWT_ACCESS_SECRET: "12345678901234567890123456789012",
        FIELD_ENCRYPTION_KEY: "12345678901234567890123456789012",
        ASSET_SIGNING_SECRET: "12345678901234567890123456789012",
        DIGITAL_ID_SECRET: "12345678901234567890123456789012",
        CORS_ORIGIN: "http://localhost:3000,https://app.savjax.com",
        AUTH_COOKIE_SECURE: "true",
        AUTH_COOKIE_SAME_SITE: "lax",
        TRUST_PROXY: "true",
        PHOTO_MAX_MB: "40"
      }),
    /CORS_ORIGIN must not contain localhost-style origins in production/
  );

  const prodConfig = validateEnvConfig({
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://postgres:postgres@db:5432/nexid",
    JWT_ACCESS_SECRET: "1234567890123456789012345678901234567890",
    FIELD_ENCRYPTION_KEY: "abcdefghijklmnopqrstuvwxyz1234567890ABCD",
    ASSET_SIGNING_SECRET: "asset-signing-secret-value-1234567890ABCD",
    DIGITAL_ID_SECRET: "digital-id-secret-value-1234567890ABCD",
    CORS_ORIGIN: "https://app.savjax.com,https://admin.savjax.com",
    AUTH_COOKIE_SECURE: "true",
    AUTH_COOKIE_SAME_SITE: "lax",
    TRUST_PROXY: "true",
    PHOTO_MAX_MB: "40"
  });
  assert.equal(prodConfig.NODE_ENV, "production");
  assert.equal(prodConfig.AUTH_COOKIE_SECURE, "true");
}

function runRetentionHelperChecks() {
  const platformService = new PlatformService(
    {} as never,
    {} as never,
    {} as never,
    new ConfigService({})
  );

  const defaults = (platformService as any).resolveRetentionPolicy({});
  assert.deepEqual(defaults, {
    otpRetentionHours: 24,
    resetTokenRetentionHours: 24,
    sessionRetentionDays: 30,
    artifactRetentionDays: 14
  });

  const overrides = (platformService as any).resolveRetentionPolicy({
    otpRetentionHours: 48,
    resetTokenRetentionHours: 12,
    sessionRetentionDays: 60,
    artifactRetentionDays: 21
  });
  assert.deepEqual(overrides, {
    otpRetentionHours: 48,
    resetTokenRetentionHours: 12,
    sessionRetentionDays: 60,
    artifactRetentionDays: 21
  });
}

function runGeneratedArtifactAccessChecks() {
  const platformService = new PlatformService(
    {} as never,
    {} as never,
    {} as never,
    new ConfigService({})
  );

  const assertCanAccessGeneratedArtifact = (platformService as any).assertCanAccessGeneratedArtifact.bind(platformService);

  assert.doesNotThrow(() =>
    assertCanAccessGeneratedArtifact({ normalizedRole: Role.SUPER_ADMIN }, "PRINT_JOB")
  );
  assert.doesNotThrow(() =>
    assertCanAccessGeneratedArtifact({ normalizedRole: Role.PRINT_OPS }, "PRINT_JOB")
  );
  assert.doesNotThrow(() =>
    assertCanAccessGeneratedArtifact({ normalizedRole: Role.SALES_PERSON }, "RENDER_BATCH")
  );

  assert.throws(
    () => assertCanAccessGeneratedArtifact({ normalizedRole: Role.SALES_PERSON }, "PRINT_JOB"),
    ForbiddenException
  );
  assert.throws(
    () => assertCanAccessGeneratedArtifact({ normalizedRole: Role.SCHOOL_STAFF }, "RENDER_BATCH"),
    ForbiddenException
  );
}

function runAdminExportRestrictionChecks() {
  const adminService = new AdminService(
    {} as never,
    {} as never,
    {} as never,
    new DataProtectionService(
      new ConfigService({
        NODE_ENV: "test",
        FIELD_ENCRYPTION_KEY: "security-smoke-test-key"
      })
    ),
    {} as never
  );

  const assertCanExportSchoolReport = (adminService as any).assertCanExportSchoolReport.bind(adminService);
  const assertCanGeneratePrintArtifact = (adminService as any).assertCanGeneratePrintArtifact.bind(adminService);
  const assertCanExportPrintJob = (adminService as any).assertCanExportPrintJob.bind(adminService);
  const assertCanExportRenderBatch = (adminService as any).assertCanExportRenderBatch.bind(adminService);

  assert.doesNotThrow(() => assertCanExportSchoolReport({ normalizedRole: Role.SALES_PERSON }));
  assert.doesNotThrow(() => assertCanExportSchoolReport({ normalizedRole: Role.SCHOOL_ADMIN }));
  assert.throws(() => assertCanExportSchoolReport({ normalizedRole: Role.SCHOOL_STAFF }), ForbiddenException);

  assert.doesNotThrow(() => assertCanGeneratePrintArtifact({ normalizedRole: Role.PRINTING }));
  assert.doesNotThrow(() => assertCanGeneratePrintArtifact({ normalizedRole: Role.SCHOOL_ADMIN }));
  assert.throws(() => assertCanGeneratePrintArtifact({ normalizedRole: Role.SALES_PERSON }), ForbiddenException);

  assert.doesNotThrow(() => assertCanExportPrintJob({ normalizedRole: Role.PRINTING }));
  assert.doesNotThrow(() => assertCanExportPrintJob({ normalizedRole: Role.SCHOOL_ADMIN }));
  assert.throws(() => assertCanExportPrintJob({ normalizedRole: Role.SALES_PERSON }), ForbiddenException);

  assert.doesNotThrow(() => assertCanExportRenderBatch({ normalizedRole: Role.PRINT_OPS }));
  assert.doesNotThrow(() => assertCanExportRenderBatch({ normalizedRole: Role.SALES_PERSON }));
  assert.throws(() => assertCanExportRenderBatch({ normalizedRole: Role.SCHOOL_STAFF }), ForbiddenException);
}

function runAdminScopedSchoolResolutionChecks() {
  const adminService = new AdminService(
    {} as never,
    {} as never,
    {} as never,
    new DataProtectionService(
      new ConfigService({
        NODE_ENV: "test",
        FIELD_ENCRYPTION_KEY: "security-smoke-test-key"
      })
    ),
    {} as never
  );

  const resolveScopedSchoolIds = (adminService as any).resolveScopedSchoolIds.bind(adminService);

  assert.equal(resolveScopedSchoolIds({ normalizedRole: Role.SUPER_ADMIN, assignedSchoolIds: [] }), undefined);
  assert.equal(resolveScopedSchoolIds({ normalizedRole: Role.COMPANY_ADMIN, assignedSchoolIds: [] }), undefined);

  assert.deepEqual(
    resolveScopedSchoolIds({ normalizedRole: Role.SALES_PERSON, assignedSchoolIds: ["school-1", "school-2"] }),
    ["school-1", "school-2"]
  );
  assert.deepEqual(
    resolveScopedSchoolIds(
      { normalizedRole: Role.SALES_PERSON, assignedSchoolIds: ["school-1", "school-2"] },
      "school-2"
    ),
    ["school-2"]
  );
  assert.throws(
    () =>
      resolveScopedSchoolIds(
        { normalizedRole: Role.SALES_PERSON, assignedSchoolIds: ["school-1", "school-2"] },
        "school-9"
      ),
    ForbiddenException
  );

  assert.deepEqual(
    resolveScopedSchoolIds({ normalizedRole: Role.SCHOOL_ADMIN, schoolId: "school-1", assignedSchoolIds: ["school-1"] }),
    ["school-1"]
  );
  assert.deepEqual(
    resolveScopedSchoolIds(
      { normalizedRole: Role.SCHOOL_ADMIN, schoolId: "school-1", assignedSchoolIds: ["school-1"] },
      "school-1"
    ),
    ["school-1"]
  );
  assert.throws(
    () =>
      resolveScopedSchoolIds(
        { normalizedRole: Role.SCHOOL_ADMIN, schoolId: "school-1", assignedSchoolIds: ["school-1"] },
        "school-2"
      ),
    ForbiddenException
  );

  assert.deepEqual(
    resolveScopedSchoolIds({ normalizedRole: Role.PRINT_OPS, assignedSchoolIds: ["school-4", "school-4", "school-5"] }),
    ["school-4", "school-5"]
  );
  assert.throws(
    () => resolveScopedSchoolIds({ normalizedRole: Role.SUPPORT, assignedSchoolIds: [] }),
    ForbiddenException
  );
}

async function runPublicLinkHardeningChecks() {
  const auditLogWrites: Array<Record<string, unknown>> = [];
  const schoolsService = new SchoolsService(
    {
      auditLog: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          auditLogWrites.push(data);
          return data;
        }
      }
    } as never,
    {} as never
  );

  const generatePublicIntakeToken = (schoolsService as any).generatePublicIntakeToken.bind(schoolsService);
  const publicLinkAuditEntityId = (schoolsService as any).publicLinkAuditEntityId.bind(schoolsService);
  const buildPublicIntakeLinkResponse = (schoolsService as any).buildPublicIntakeLinkResponse.bind(schoolsService);
  const assertPublicLookupRateLimit = (schoolsService as any).assertPublicLookupRateLimit.bind(schoolsService);
  const recordPublicLookupMiss = (schoolsService as any).recordPublicLookupMiss.bind(schoolsService);

  const token = generatePublicIntakeToken();
  assert.match(token, /^lnk_[a-f0-9]{40}$/);

  const auditIdA = publicLinkAuditEntityId("lnk_public_demo_token");
  const auditIdB = publicLinkAuditEntityId("lnk_public_demo_token");
  const auditIdC = publicLinkAuditEntityId("lnk_other_demo_token");
  assert.equal(auditIdA, auditIdB);
  assert.notEqual(auditIdA, auditIdC);
  assert.equal(String(auditIdA).includes("lnk_public_demo_token"), false);

  const publicResponse = buildPublicIntakeLinkResponse({
    token: "lnk_123",
    campaignName: "Demo Intake",
    institutionType: "SCHOOL",
    audience: "PARENT",
    className: "10",
    section: "A",
    maxStudentsPerParent: 3,
    photoBgPreference: "WHITE",
    allowSiblings: true,
    allowDraftSave: false,
    photoCaptureRequired: true,
    allowPhotoUpload: true,
    paymentRequired: false,
    expiresAt: new Date("2026-03-31T00:00:00.000Z"),
    school: { name: "Demo School", code: "DEMO001" },
    templateId: "should-not-leak",
    metadataJson: { unsafe: true }
  });
  assert.deepEqual(Object.keys(publicResponse).sort(), [
    "allowDraftSave",
    "allowPhotoUpload",
    "allowSiblings",
    "audience",
    "campaignName",
    "className",
    "expiresAt",
    "institutionType",
    "maxStudentsPerParent",
    "paymentRequired",
    "photoBgPreference",
    "photoCaptureRequired",
    "school",
    "section",
    "token"
  ]);

  const context = { ip: "203.0.113.10", userAgent: "security-smoke" };
  for (let attempt = 0; attempt < 10; attempt += 1) {
    recordPublicLookupMiss("lnk_public_demo_token", context);
  }

  await assert.rejects(async () => {
    try {
      await assertPublicLookupRateLimit("lnk_public_demo_token", context);
      assert.fail("Expected public lookup rate limit to throw");
    } catch (error) {
      assert.ok(error instanceof HttpException);
      assert.equal(error.getStatus(), HttpStatus.TOO_MANY_REQUESTS);
      throw error;
    }
  });
  assert.ok(auditLogWrites.some((entry) => entry.action === "PUBLIC_LINK_RATE_LIMITED"));
}

async function main() {
  runDataProtectionChecks();
  runTenantScopeChecks();
  runRoleAliasChecks();
  runOtpAuditIdentityChecks();
  runEnvValidationChecks();
  runRetentionHelperChecks();
  runGeneratedArtifactAccessChecks();
  runAdminExportRestrictionChecks();
  runAdminScopedSchoolResolutionChecks();
  await runPublicLinkHardeningChecks();
  console.log("security smoke checks passed");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
