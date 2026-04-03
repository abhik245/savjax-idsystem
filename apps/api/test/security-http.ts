import * as assert from "node:assert/strict";
import { randomBytes } from "crypto";
import { IntakeAudience, PrismaClient } from "@prisma/client";

const API_BASE = process.env.API_BASE || "http://localhost:4000/api/v2";
const prisma = new PrismaClient();

type Portal = "all" | "company" | "school";

type Session = {
  user: {
    id: string;
    role: string;
    schoolId: string | null;
    assignedSchoolIds: string[];
    permissions: string[];
    parentId: string | null;
    email?: string;
    name?: string;
  };
  cookieHeader: string;
};

type SchoolRow = {
  id: string;
  name: string;
  code: string;
};

const SEEDED_EMAILS = [
  "main.admin@demo.com",
  "company.admin@demo.com",
  "sales@demo.com",
  "printer@demo.com",
  "school.admin@demo.com",
  "school.staff@demo.com"
];

const CREDENTIALS: Record<string, { endpoint: string; email: string; password: string }> = {
  super: { endpoint: "/auth/login", email: "main.admin@demo.com", password: "Admin@123" },
  company: { endpoint: "/auth/company/login", email: "company.admin@demo.com", password: "Admin@123" },
  sales: { endpoint: "/auth/company/login", email: "sales@demo.com", password: "Admin@123" },
  printer: { endpoint: "/auth/company/login", email: "printer@demo.com", password: "Admin@123" },
  schoolAdmin: { endpoint: "/auth/school/login", email: "school.admin@demo.com", password: "Admin@123" },
  schoolStaff: { endpoint: "/auth/school/login", email: "school.staff@demo.com", password: "Admin@123" }
};

function makeIp(seed: string) {
  const bytes = Buffer.from(seed.padEnd(8, "0")).slice(0, 4);
  return `198.${bytes[0] % 200}.${bytes[1] % 200}.${Math.max(1, bytes[2] % 200)}`;
}

function buildCookieHeader(cookies: string[]) {
  const parts = cookies
    .map((cookie) => cookie.split(";")[0]?.trim())
    .filter((value): value is string => Boolean(value));
  return parts.join("; ");
}

async function requestJson(path: string, options: RequestInit & { expected?: number | number[] } = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const rawText = await response.text();
  const body = rawText ? safeParseJson(rawText) : null;
  const expectedList = Array.isArray(options.expected)
    ? options.expected
    : options.expected !== undefined
      ? [options.expected]
      : undefined;

  if (expectedList && !expectedList.includes(response.status)) {
    throw new Error(`Expected ${expectedList.join(",")} for ${path}, received ${response.status}: ${rawText}`);
  }

  return { response, body, rawText };
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function login(label: keyof typeof CREDENTIALS, ipSeed: string): Promise<Session> {
  const credentials = CREDENTIALS[label];
  const { response, body, rawText } = await requestJson(credentials.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": makeIp(ipSeed),
      "user-agent": `security-http/${label}`
    },
    body: JSON.stringify({
      email: credentials.email,
      password: credentials.password,
      deviceId: `security-http-${label}`
    }),
    expected: [200, 201]
  });

  const setCookies = ((response.headers as any).getSetCookie?.() as string[] | undefined) || [];
  const cookieHeader = buildCookieHeader(setCookies);
  assert.ok(cookieHeader.includes("nexid_access_token=") || cookieHeader.includes("nexid_refresh_token="));
  assert.ok(body?.user, `Missing user payload for ${label}: ${rawText}`);

  return {
    user: body.user,
    cookieHeader
  };
}

function authHeaders(session: Session, extra?: Record<string, string>) {
  return {
    Cookie: session.cookieHeader,
    "user-agent": `security-http/${session.user.role}`,
    ...(extra || {})
  };
}

async function getSchools(session: Session, expected = 200) {
  const { body } = await requestJson("/schools", {
    method: "GET",
    headers: authHeaders(session),
    expected
  });
  return body as SchoolRow[];
}

async function getSchoolDetail(session: Session, schoolId: string, expected: number) {
  return requestJson(`/admin/schools/${schoolId}/detail`, {
    method: "GET",
    headers: authHeaders(session),
    expected
  });
}

async function getSchoolReportCsv(session: Session, schoolId: string, expected: number) {
  const response = await fetch(`${API_BASE}/admin/reports/schools.csv?schoolId=${encodeURIComponent(schoolId)}`, {
    method: "GET",
    headers: authHeaders(session)
  });
  const text = await response.text();
  assert.equal(response.status, expected, `Unexpected schools.csv status: ${response.status} ${text}`);
  return { response, text };
}

async function listPrintJobs(session: Session, expected = 200) {
  const { body } = await requestJson("/admin/print-jobs", {
    method: "GET",
    headers: authHeaders(session),
    expected
  });
  return body as Array<{ id: string }>;
}

async function exportPrintJobCsv(session: Session, printJobId: string, expected: number) {
  const response = await fetch(`${API_BASE}/admin/print-jobs/${printJobId}/export.csv`, {
    method: "GET",
    headers: authHeaders(session)
  });
  const text = await response.text();
  assert.equal(response.status, expected, `Unexpected print-job export status: ${response.status} ${text}`);
  return { response, text };
}

async function getAuthAnomalies(session: Session, expected: number) {
  return requestJson("/platform/security/auth-anomalies?limit=20", {
    method: "GET",
    headers: authHeaders(session),
    expected
  });
}

async function getSecurityEventFeed(session: Session, expected: number) {
  return requestJson("/platform/security/event-feed?limit=20", {
    method: "GET",
    headers: authHeaders(session),
    expected
  });
}

async function getRetentionSummary(session: Session, expected: number) {
  return requestJson("/platform/security/retention/summary", {
    method: "GET",
    headers: authHeaders(session),
    expected
  });
}

async function listMaskPolicies(session: Session, schoolId: string, expected: number) {
  return requestJson(`/platform/security/mask-policies?schoolId=${encodeURIComponent(schoolId)}`, {
    method: "GET",
    headers: authHeaders(session),
    expected
  });
}

async function upsertMaskPolicy(
  session: Session,
  payload: {
    schoolId: string;
    fieldKey: string;
    rolesAllowed: string[];
    maskStrategy: string;
    isActive: boolean;
  },
  expected: number
) {
  return requestJson("/platform/security/mask-policies", {
    method: "POST",
    headers: {
      ...authHeaders(session),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    expected
  });
}

async function revokeSessions(session: Session, userId: string, expected: number) {
  return requestJson("/platform/security/revoke-sessions", {
    method: "POST",
    headers: {
      ...authHeaders(session),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ userId, revokeMfa: false }),
    expected
  });
}

async function resetSeededAuthState() {
  await prisma.user.updateMany({
    where: { email: { in: SEEDED_EMAILS } },
    data: { failedLoginCount: 0, lockoutUntil: null }
  });
}

async function logout(session: Session) {
  await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    headers: {
      ...authHeaders(session),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({})
  });
}

async function createEphemeralIntakeLink() {
  const school = await prisma.school.findFirst({
    where: { deletedAt: null, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, institutionType: true }
  });
  assert.ok(school, "Expected at least one active school for public-link checks");

  const token = `qa-link-${randomBytes(8).toString("hex")}`;
  const link = await prisma.intakeLink.create({
    data: {
      schoolId: school.id,
      token,
      campaignName: "Security HTTP QA Link",
      institutionType: school.institutionType,
      audience: IntakeAudience.PARENT,
      className: "ALL",
      section: "ALL",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      photoBgPreference: "WHITE"
    },
    select: { id: true, token: true }
  });

  return link;
}

async function runRoleScopeChecks() {
  const superSession = await login("super", randomBytes(4).toString("hex"));
  const companySession = await login("company", randomBytes(4).toString("hex"));
  const salesSession = await login("sales", randomBytes(4).toString("hex"));
  const schoolAdminSession = await login("schoolAdmin", randomBytes(4).toString("hex"));
  const schoolStaffSession = await login("schoolStaff", randomBytes(4).toString("hex"));

  const superSchools = await getSchools(superSession);
  assert.ok(superSchools.length >= 2, "Expected at least 2 schools from super admin scope");

  const salesSchools = await getSchools(salesSession);
  assert.ok(salesSchools.length >= 1, "Expected at least 1 assigned school for sales");

  const schoolAdminSchools = await getSchools(schoolAdminSession);
  assert.equal(schoolAdminSchools.length, 1, "School admin should only see one school");

  const schoolStaffSchools = await getSchools(schoolStaffSession);
  assert.equal(schoolStaffSchools.length, 1, "School staff should only see one school");

  const salesAssignedId = salesSchools[0].id;
  const unassignedForSales = superSchools.find((school) => !salesSchools.some((row) => row.id === school.id));
  assert.ok(unassignedForSales, "Expected at least one school outside sales assignment");

  const schoolAdminOwnId = schoolAdminSchools[0].id;
  const schoolAdminOther = superSchools.find((school) => school.id !== schoolAdminOwnId);
  assert.ok(schoolAdminOther, "Expected another school for school admin negative scope test");

  const salesAssignedDetail = await getSchoolDetail(salesSession, salesAssignedId, 200);
  assert.equal((salesAssignedDetail.body as any)?.school?.id, salesAssignedId);

  const salesForbiddenDetail = await getSchoolDetail(salesSession, unassignedForSales!.id, 403);
  assert.match(JSON.stringify(salesForbiddenDetail.body), /Access denied|Forbidden/i);

  const schoolAdminOwnDetail = await getSchoolDetail(schoolAdminSession, schoolAdminOwnId, 200);
  assert.equal((schoolAdminOwnDetail.body as any)?.school?.id, schoolAdminOwnId);

  const schoolAdminForbiddenDetail = await getSchoolDetail(schoolAdminSession, schoolAdminOther!.id, 403);
  assert.match(JSON.stringify(schoolAdminForbiddenDetail.body), /Access denied|Forbidden/i);

  const schoolStaffCsv = await getSchoolReportCsv(schoolStaffSession, schoolAdminOwnId, 403);
  assert.match(schoolStaffCsv.text, /Forbidden|Access denied|Not allowed/i);

  const superCsv = await getSchoolReportCsv(superSession, schoolAdminOwnId, 200);
  assert.match(superCsv.response.headers.get("content-type") || "", /text\/csv/i);
  assert.match(superCsv.text, /School Code,School Name,Email/i);

  const printJobs = await listPrintJobs(superSession);
  if (printJobs.length > 0) {
    const salesPrintExport = await exportPrintJobCsv(salesSession, printJobs[0].id, 403);
    assert.match(salesPrintExport.text, /Forbidden|Access denied/i);
  }

  const anomalies = await getAuthAnomalies(superSession, 200);
  assert.ok(Array.isArray((anomalies.body as any)?.recent), "Expected auth anomaly feed for super admin");

  const securityEvents = await getSecurityEventFeed(superSession, 200);
  assert.ok(Array.isArray((securityEvents.body as any)?.recent), "Expected security event feed for super admin");

  const retention = await getRetentionSummary(companySession, 200);
  assert.ok((retention.body as any)?.summary?.otpChallenges, "Expected retention summary for company admin");

  const schoolAdminRetention = await getRetentionSummary(schoolAdminSession, 403);
  assert.match(JSON.stringify(schoolAdminRetention.body), /Forbidden|Access denied/i);

  const schoolStaffAnomalies = await getAuthAnomalies(schoolStaffSession, 403);
  assert.match(JSON.stringify(schoolStaffAnomalies.body), /Forbidden|Access denied/i);

  const schoolStaffSecurityFeed = await getSecurityEventFeed(schoolStaffSession, 403);
  assert.match(JSON.stringify(schoolStaffSecurityFeed.body), /Forbidden|Access denied/i);

  const schoolAdminMaskPolicies = await listMaskPolicies(schoolAdminSession, schoolAdminOwnId, 200);
  assert.ok(Array.isArray(schoolAdminMaskPolicies.body), "School admin should list own-school mask policies");

  const schoolStaffMaskPolicies = await listMaskPolicies(schoolStaffSession, schoolAdminOwnId, 403);
  assert.match(JSON.stringify(schoolStaffMaskPolicies.body), /Forbidden|Access denied/i);

  const upsertedPolicy = await upsertMaskPolicy(
    superSession,
    {
      schoolId: schoolAdminOwnId,
      fieldKey: "parentMobile",
      rolesAllowed: ["SUPER_ADMIN", "COMPANY_ADMIN", "SCHOOL_ADMIN"],
      maskStrategy: "PARTIAL",
      isActive: true
    },
    201
  );
  assert.equal((upsertedPolicy.body as any)?.schoolId, schoolAdminOwnId);

  const policyListAfterUpsert = await listMaskPolicies(superSession, schoolAdminOwnId, 200);
  assert.ok(
    Array.isArray(policyListAfterUpsert.body) &&
      (policyListAfterUpsert.body as Array<{ fieldKey?: string }>).some((row) => row.fieldKey === "parentMobile"),
    "Expected upserted mask policy to be listed"
  );

  const salesMaskUpsert = await upsertMaskPolicy(
    salesSession,
    {
      schoolId: schoolAdminOwnId,
      fieldKey: "address",
      rolesAllowed: ["SUPER_ADMIN"],
      maskStrategy: "FULL",
      isActive: true
    },
    403
  );
  assert.match(JSON.stringify(salesMaskUpsert.body), /Forbidden|Access denied/i);

  const revokeResult = await revokeSessions(superSession, schoolStaffSession.user.id, 201);
  assert.ok((revokeResult.body as any)?.revokedSessions >= 1, "Expected session revocation to revoke at least one session");

  await Promise.all([
    logout(superSession),
    logout(companySession),
    logout(salesSession),
    logout(schoolAdminSession),
    logout(schoolStaffSession)
  ]);
}

async function runPublicLinkChecks(validToken: string) {
  const valid = await requestJson(`/intake-links/token/${validToken}`, {
    headers: {
      "x-forwarded-for": makeIp(randomBytes(4).toString("hex")),
      "user-agent": "security-http/public-link-valid"
    },
    expected: 200
  });
  const validKeys = Object.keys(valid.body as Record<string, unknown>).sort();
  assert.deepEqual(validKeys, [
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

  const missingToken = `lnk_missing_${randomBytes(8).toString("hex")}`;
  const missing = await requestJson(`/intake-links/token/${missingToken}`, {
    headers: {
      "x-forwarded-for": makeIp(randomBytes(4).toString("hex")),
      "user-agent": "security-http/public-link-missing"
    },
    expected: 404
  });
  assert.match(JSON.stringify(missing.body), /Link not found/i);

  const throttledToken = `lnk_probe_${randomBytes(6).toString("hex")}`;
  const throttleIp = makeIp(randomBytes(4).toString("hex"));
  let throttleStatus = 404;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const result = await requestJson(`/campaigns/token/${throttledToken}`, {
      headers: {
        "x-forwarded-for": throttleIp,
        "user-agent": `security-http/public-link-throttle-${attempt}`
      },
      expected: [404, 429]
    });
    throttleStatus = result.response.status;
    if (throttleStatus === 429) break;
  }
  assert.equal(throttleStatus, 429, "Expected repeated public-link misses to trigger 429 throttling");
}

async function main() {
  await resetSeededAuthState();
  const tempLink = await createEphemeralIntakeLink();
  await runRoleScopeChecks();
  await runPublicLinkChecks(tempLink.token);
  console.log("security http checks passed");
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.intakeLink.deleteMany({
      where: {
        campaignName: "Security HTTP QA Link"
      }
    });
    await prisma.$disconnect();
  });

