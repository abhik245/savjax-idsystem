import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, resolve, relative } from "path";

const ROOT = resolve(process.cwd());
const API_BASE = (process.env.API_BASE || "http://localhost:4000/api/v2").replace(/\/+$/, "");
const WEB_BASE = (process.env.WEB_BASE || "http://localhost:3000").replace(/\/+$/, "");
const REPORT_JSON = join(ROOT, "docs", "PHASE_16_30_FINAL_CHECK_REPORT.json");
const REPORT_MD = join(ROOT, "docs", "PHASE_16_30_FINAL_CHECK_REPORT.md");

const CREDENTIALS = {
  super: { email: "main.admin@demo.com", password: "Admin@123" },
  company: { email: "company.admin@demo.com", password: "Admin@123" },
  sales: { email: "sales@demo.com", password: "Admin@123" },
  printer: { email: "printer@demo.com", password: "Admin@123" },
  schoolAdmin: { email: "school.admin@demo.com", password: "Admin@123" },
  schoolStaff: { email: "school.staff@demo.com", password: "Admin@123" }
};

const ALLOWED_STATUSES = new Set([200, 201, 202, 204, 400, 401, 403, 404, 405, 409, 410, 422, 429]);

function nowIso() {
  return new Date().toISOString();
}

async function request(method, url, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: null,
      text: String(error),
      parseError: null
    };
  }

  const text = await response.text();
  let parsed = null;
  let parseError = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      parseError = String(error);
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    body: parsed,
    text,
    parseError
  };
}

function normalizePath(...parts) {
  return parts
    .filter(Boolean)
    .join("/")
    .replace(/\/+/g, "/")
    .replace(/^\/+/, "");
}

function parseControllerRoutes() {
  const controllers = collectControllerFiles(join(ROOT, "apps", "api", "src", "modules"));
  const routes = [];
  const controllerRegex = /@Controller\(([^)]*)\)/m;
  const routeRegex = /@(Get|Post|Patch|Delete)\("([^"]*)"\)/g;
  const stringRegex = /["'`]([^"'`]*)["'`]/;

  for (const file of controllers) {
    const raw = readFileSync(file, "utf8");
    const controllerMatch = raw.match(controllerRegex);
    let controllerPrefix = "";
    if (controllerMatch) {
      const stringMatch = controllerMatch[1].match(stringRegex);
      controllerPrefix = stringMatch?.[1] || "";
    }

    let match;
    while ((match = routeRegex.exec(raw)) !== null) {
      const method = match[1].toUpperCase();
      const routePath = match[2] || "";
      const fullPath = normalizePath(controllerPrefix, routePath);
      routes.push({
        method,
        routePath,
        fullPath,
        file: relative(ROOT, file).replace(/\\/g, "/")
      });
    }
  }

  const dedupe = new Map();
  for (const route of routes) {
    const key = `${route.method} ${route.fullPath}`;
    if (!dedupe.has(key)) dedupe.set(key, route);
  }
  return [...dedupe.values()].sort((a, b) => {
    if (a.fullPath === b.fullPath) return a.method.localeCompare(b.method);
    return a.fullPath.localeCompare(b.fullPath);
  });
}

function collectControllerFiles(dir) {
  const out = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectControllerFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".controller.ts")) {
      out.push(full);
    }
  }
  return out;
}

function buildRoutePath(route, ctx) {
  return route.fullPath.replace(/:([A-Za-z0-9_]+)/g, (_, key) => {
    if (key === "token") {
      if (route.fullPath.includes("assets/:token")) return "invalid-signed-token";
      return ctx.intakeToken || "demo-school-2026";
    }
    return (
      ctx[key] ||
      {
        schoolId: ctx.schoolId || "school_test_id",
        studentId: ctx.studentId || "student_test_id",
        userId: ctx.userId || "user_test_id",
        assignmentId: ctx.assignmentId || "assignment_test_id",
        printJobId: ctx.printJobId || "print_job_test_id",
        workflowId: ctx.workflowId || "workflow_test_id",
        chainId: ctx.chainId || "chain_test_id",
        templateId: ctx.templateId || "template_test_id",
        ruleId: ctx.ruleId || "rule_test_id",
        jobId: ctx.jobId || "job_test_id"
      }[key] ||
      `${key}_test_id`
    );
  });
}

function randomMobile() {
  return `9${Math.floor(100000000 + Math.random() * 899999999)}`;
}

function randomRoll() {
  return `R-${Date.now().toString().slice(-6)}`;
}

function apiUrl(path) {
  return `${API_BASE}/${path.replace(/^\/+/, "")}`;
}

function webUrl(path) {
  return `${WEB_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

function passStatus(status) {
  return ALLOWED_STATUSES.has(status) && status !== 500;
}

async function loginVia(path, creds) {
  const result = await request("POST", apiUrl(path), { body: creds });
  if (result.status !== 201 && result.status !== 200) {
    throw new Error(`Login failed for ${creds.email} via ${path}: ${result.status} ${result.text}`);
  }
  const accessToken = result.body?.accessToken;
  const refreshToken = result.body?.refreshToken;
  if (!accessToken) throw new Error(`Missing accessToken for ${creds.email}`);
  return {
    accessToken,
    refreshToken: refreshToken || null,
    role: result.body?.user?.role || null,
    raw: result.body
  };
}

async function run() {
  const startedAt = nowIso();
  const report = {
    startedAt,
    apiBase: API_BASE,
    webBase: WEB_BASE,
    phaseWindow: "16-30",
    webChecks: [],
    authChecks: [],
    flowChecks: [],
    apiRouteChecks: [],
    failures: [],
    summary: {
      webPass: 0,
      webTotal: 0,
      authPass: 0,
      authTotal: 0,
      flowPass: 0,
      flowTotal: 0,
      apiPass: 0,
      apiTotal: 0
    },
    context: {}
  };

  // 1) Web route checks
  const webRoutes = [
    "/",
    "/login",
    "/dashboard",
    "/dashboard/access",
    "/parent/portal",
    "/parent/intake?intake_token=demo-school-2026",
    "/parent/intake?token=demo-school-2026"
  ];

  for (const route of webRoutes) {
    const res = await request("GET", webUrl(route));
    const ok = res.status >= 200 && res.status < 400;
    report.webChecks.push({ route, status: res.status, ok });
    report.summary.webTotal += 1;
    if (ok) report.summary.webPass += 1;
  }

  // 2) Auth checks by role
  const sessions = {};
  const loginMatrix = [
    { key: "super", path: "auth/login", creds: CREDENTIALS.super },
    { key: "company", path: "auth/login", creds: CREDENTIALS.company },
    { key: "sales", path: "auth/login", creds: CREDENTIALS.sales },
    { key: "printer", path: "auth/login", creds: CREDENTIALS.printer },
    { key: "schoolAdmin", path: "auth/login", creds: CREDENTIALS.schoolAdmin },
    { key: "schoolStaff", path: "auth/login", creds: CREDENTIALS.schoolStaff }
  ];

  for (const item of loginMatrix) {
    let ok = false;
    let status = 0;
    let detail = "";
    try {
      const login = await loginVia(item.path, item.creds);
      sessions[item.key] = login;
      const me = await request("GET", apiUrl("auth/me"), { token: login.accessToken });
      ok = me.status === 200 && !!me.body?.user?.role;
      status = me.status;
      detail = me.body?.user?.role || "";
    } catch (error) {
      detail = String(error);
    }
    report.authChecks.push({
      key: item.key,
      email: item.creds.email,
      status,
      ok,
      detail
    });
    report.summary.authTotal += 1;
    if (ok) report.summary.authPass += 1;
  }

  // 3) Parent OTP + parent submission flow
  const parentMobile = randomMobile();
  const otpSend = await request("POST", apiUrl("auth/parent/send-otp"), {
    body: { mobile: parentMobile }
  });
  const otpValue = otpSend.body?.devOtp || "123456";
  const otpVerify = await request("POST", apiUrl("auth/parent/verify-otp"), {
    body: { mobile: parentMobile, otp: otpValue }
  });
  const parentToken = otpVerify.body?.accessToken || null;
  sessions.parent = { accessToken: parentToken };

  report.flowChecks.push({
    key: "parent_otp_send",
    status: otpSend.status,
    ok: otpSend.status === 200 || otpSend.status === 201
  });
  report.flowChecks.push({
    key: "parent_otp_verify",
    status: otpVerify.status,
    ok: otpVerify.status === 200 || otpVerify.status === 201
  });
  report.summary.flowTotal += 2;
  if (otpSend.status === 200 || otpSend.status === 201) report.summary.flowPass += 1;
  if (otpVerify.status === 200 || otpVerify.status === 201) report.summary.flowPass += 1;

  // 4) Build route context for parameterized endpoints
  const ctx = {
    intakeToken: "demo-school-2026",
    schoolId: null,
    studentId: null,
    userId: null,
    assignmentId: null,
    printJobId: null,
    workflowId: null,
    chainId: null,
    templateId: null,
    ruleId: null,
    jobId: null,
    invoiceId: null
  };

  const superToken = sessions.super?.accessToken;
  if (!superToken) {
    throw new Error("Super admin token missing; cannot continue route sweep");
  }

  const schools = await request("GET", apiUrl("schools"), { token: superToken });
  const schoolList = Array.isArray(schools.body) ? schools.body : [];
  if (schoolList.length > 0) {
    ctx.schoolId = schoolList[0].id;
  }

  const usersRes = await request("GET", apiUrl("admin/users"), { token: superToken });
  const users = Array.isArray(usersRes.body) ? usersRes.body : [];
  const userCandidate = users.find((u) => u.id !== sessions.super?.raw?.user?.id);
  if (userCandidate) ctx.userId = userCandidate.id;

  if (ctx.schoolId) {
    const studentsRes = await request(
      "GET",
      apiUrl(`admin/schools/${ctx.schoolId}/students?page=1&pageSize=10`),
      { token: superToken }
    );
    const students = studentsRes.body?.rows || [];
    if (students[0]?.id) ctx.studentId = students[0].id;

    const assignmentsRes = await request("GET", apiUrl(`admin/sales-assignments?schoolId=${ctx.schoolId}`), {
      token: superToken
    });
    const assignments = Array.isArray(assignmentsRes.body) ? assignmentsRes.body : [];
    if (assignments[0]?.id) ctx.assignmentId = assignments[0].id;

    const templatesRes = await request("GET", apiUrl(`admin/schools/${ctx.schoolId}/templates`), {
      token: superToken
    });
    const templates = Array.isArray(templatesRes.body) ? templatesRes.body : [];
    if (templates[0]?.id) ctx.templateId = templates[0].id;

    const chainRes = await request("GET", apiUrl(`admin/schools/${ctx.schoolId}/approval-chains`), {
      token: superToken
    });
    const chains = Array.isArray(chainRes.body) ? chainRes.body : [];
    if (chains[0]?.id) ctx.chainId = chains[0].id;
  }

  const printJobsRes = await request("GET", apiUrl("admin/print-jobs"), { token: superToken });
  const printJobs = Array.isArray(printJobsRes.body) ? printJobsRes.body : [];
  if (printJobs[0]?.id) ctx.printJobId = printJobs[0].id;

  const workflowsRes = await request("GET", apiUrl("admin/approval-workflows"), { token: superToken });
  const workflows = workflowsRes.body?.rows || [];
  if (workflows[0]?.id) ctx.workflowId = workflows[0].id;

  if (ctx.schoolId) {
    const invoiceCreate = await request("POST", apiUrl("billing/invoices"), {
      token: superToken,
      body: {
        schoolId: ctx.schoolId,
        amount: 1000,
        taxPercent: 18,
        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        notes: "Phase 16-30 verification invoice"
      }
    });
    if (invoiceCreate.status === 200 || invoiceCreate.status === 201) {
      ctx.invoiceId = invoiceCreate.body?.id || null;
    }

    const asyncJobCreate = await request("POST", apiUrl("platform/async-jobs"), {
      token: superToken,
      body: { schoolId: ctx.schoolId, type: "REPORT_EXPORT", payload: { schoolId: ctx.schoolId } }
    });
    if (asyncJobCreate.status === 200 || asyncJobCreate.status === 201) {
      ctx.jobId = asyncJobCreate.body?.id || null;
    }

    const ruleCreate = await request("POST", apiUrl("platform/workflow-rules"), {
      token: superToken,
      body: {
        schoolId: ctx.schoolId,
        name: `Rule-${Date.now()}`,
        triggerStage: "SUBMITTED",
        actionType: "MARK_ON_HOLD",
        isActive: true,
        priority: 100
      }
    });
    if (ruleCreate.status === 200 || ruleCreate.status === 201) {
      ctx.ruleId = ruleCreate.body?.id || null;
    }
  }

  // Parent submission check with campaign token
  const parentAnalyze = await request("POST", apiUrl("parent/photo/analyze"), {
    token: parentToken,
    body: { intakeToken: ctx.intakeToken, photoKey: "local://phase-check.jpg" }
  });
  const parentSubmit = await request("POST", apiUrl("parent/submissions"), {
    token: parentToken,
    body: {
      intakeToken: ctx.intakeToken,
      fullName: "Phase Check Student",
      parentName: "Phase Check Parent",
      parentMobile,
      className: "ALL",
      section: "ALL",
      rollNumber: randomRoll(),
      address: "Phase Check Address",
      photoKey: "local://phase-check.jpg"
    }
  });
  report.flowChecks.push({
    key: "parent_photo_analyze",
    status: parentAnalyze.status,
    ok: parentAnalyze.status === 200 || parentAnalyze.status === 201
  });
  report.flowChecks.push({
    key: "parent_submit_student",
    status: parentSubmit.status,
    ok: parentSubmit.status === 200 || parentSubmit.status === 201
  });
  report.summary.flowTotal += 2;
  if (parentAnalyze.status === 200 || parentAnalyze.status === 201) report.summary.flowPass += 1;
  if (parentSubmit.status === 200 || parentSubmit.status === 201) report.summary.flowPass += 1;

  // 5) Sweep all controller routes for non-500 behavior
  const parsedRoutes = parseControllerRoutes();
  for (const route of parsedRoutes) {
    const useFakePathParams = route.method === "DELETE";
    const routeCtx = useFakePathParams
      ? {
          ...ctx,
          schoolId: "school_fake_id",
          studentId: "student_fake_id",
          userId: "user_fake_id",
          assignmentId: "assignment_fake_id",
          printJobId: "print_job_fake_id",
          workflowId: "workflow_fake_id",
          chainId: "chain_fake_id",
          templateId: "template_fake_id",
          ruleId: "rule_fake_id",
          jobId: "job_fake_id"
        }
      : ctx;
    const path = buildRoutePath(route, routeCtx);
    const url = apiUrl(path);
    let token = superToken;
    if (route.fullPath.startsWith("auth/")) token = undefined;
    if (route.fullPath === "auth/me") token = superToken;
    if (route.fullPath.startsWith("parent/")) token = parentToken || undefined;

    let body;
    if (route.method === "POST" || route.method === "PATCH" || route.method === "DELETE") {
      body = {};
    }

    if (route.method === "POST" && route.fullPath === "auth/login") body = CREDENTIALS.super;
    if (route.method === "POST" && route.fullPath === "auth/company/login") body = CREDENTIALS.company;
    if (route.method === "POST" && route.fullPath === "auth/school/login") body = CREDENTIALS.schoolAdmin;
    if (route.method === "POST" && route.fullPath === "auth/parent/send-otp") body = { mobile: parentMobile };
    if (route.method === "POST" && route.fullPath === "auth/parent/verify-otp") {
      body = { mobile: parentMobile, otp: otpValue };
    }
    if (route.method === "POST" && route.fullPath === "auth/refresh") {
      body = { refreshToken: sessions.super?.refreshToken || "invalid_refresh" };
    }
    if (route.method === "POST" && route.fullPath === "auth/logout") {
      body = { refreshToken: sessions.super?.refreshToken || "invalid_refresh" };
    }
    if (route.method === "POST" && route.fullPath === "auth/forgot-password") {
      body = { email: CREDENTIALS.sales.email };
    }
    if (route.method === "POST" && route.fullPath === "auth/reset-password") {
      body = { token: "invalid-token", password: "Reset@123" };
    }
    if (route.method === "POST" && route.fullPath === "parent/submissions") {
      body = {
        intakeToken: ctx.intakeToken,
        fullName: "Sweep Student",
        parentName: "Sweep Parent",
        parentMobile,
        className: "ALL",
        section: "ALL",
        rollNumber: randomRoll(),
        address: "Sweep Address",
        photoKey: "local://sweep-photo.jpg"
      };
    }
    if (route.method === "POST" && route.fullPath === "parent/photo/analyze") {
      body = { intakeToken: ctx.intakeToken, photoKey: "local://sweep-photo.jpg" };
    }
    if (route.method === "POST" && route.fullPath === "billing/invoices" && ctx.schoolId) {
      body = {
        schoolId: ctx.schoolId,
        amount: 1200,
        taxPercent: 18,
        dueAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        notes: "Route sweep invoice"
      };
    }
    if (route.method === "POST" && route.fullPath === "billing/razorpay/order" && ctx.invoiceId) {
      body = { invoiceId: ctx.invoiceId, amount: 500 };
    }
    if (route.method === "POST" && route.fullPath === "platform/async-jobs" && ctx.schoolId) {
      body = { schoolId: ctx.schoolId, type: "REPORT_EXPORT", payload: { schoolId: ctx.schoolId } };
    }
    if (route.method === "POST" && route.fullPath === "platform/workflow-rules" && ctx.schoolId) {
      body = {
        schoolId: ctx.schoolId,
        name: `SweepRule-${Date.now()}`,
        triggerStage: "SUBMITTED",
        actionType: "MARK_ON_HOLD",
        isActive: true,
        priority: 110
      };
    }

    const res = await request(route.method, url, { token, body });
    const ok = passStatus(res.status);
    report.apiRouteChecks.push({
      method: route.method,
      route: `/${route.fullPath}`,
      resolvedPath: `/${path}`,
      status: res.status,
      ok,
      source: route.file
    });
    report.summary.apiTotal += 1;
    if (ok) report.summary.apiPass += 1;
  }

  // 6) Role-specific tenant isolation assertions
  // Sales should not access unassigned school detail (if possible)
  const salesToken = sessions.sales?.accessToken;
  if (salesToken && Array.isArray(schoolList) && schoolList.length > 1) {
    const meSales = await request("GET", apiUrl("auth/me"), { token: salesToken });
    const assigned = new Set(meSales.body?.user?.assignedSchoolIds || []);
    const outOfScope = schoolList.find((s) => !assigned.has(s.id));
    if (outOfScope) {
      const forbiddenTry = await request("GET", apiUrl(`admin/schools/${outOfScope.id}/detail`), {
        token: salesToken
      });
      const ok = forbiddenTry.status === 403;
      report.flowChecks.push({
        key: "tenant_isolation_sales_out_of_scope",
        status: forbiddenTry.status,
        ok
      });
      report.summary.flowTotal += 1;
      if (ok) report.summary.flowPass += 1;
    }
  }

  // School admin should not access another school
  const schoolAdminToken = sessions.schoolAdmin?.accessToken;
  if (schoolAdminToken && Array.isArray(schoolList) && schoolList.length > 1) {
    const meSchool = await request("GET", apiUrl("auth/me"), { token: schoolAdminToken });
    const ownSchoolId = meSchool.body?.user?.schoolId;
    const otherSchool = schoolList.find((s) => s.id !== ownSchoolId);
    if (otherSchool) {
      const forbiddenTry = await request("GET", apiUrl(`admin/schools/${otherSchool.id}/detail`), {
        token: schoolAdminToken
      });
      const ok = forbiddenTry.status === 403;
      report.flowChecks.push({
        key: "tenant_isolation_school_admin_out_of_scope",
        status: forbiddenTry.status,
        ok
      });
      report.summary.flowTotal += 1;
      if (ok) report.summary.flowPass += 1;
    }
  }

  // Consolidate failures
  const allSections = [report.webChecks, report.authChecks, report.flowChecks, report.apiRouteChecks];
  for (const section of allSections) {
    for (const row of section) {
      if (!row.ok) report.failures.push(row);
    }
  }

  report.context = ctx;
  report.completedAt = nowIso();
  report.summary.totalChecks =
    report.summary.webTotal + report.summary.authTotal + report.summary.flowTotal + report.summary.apiTotal;
  report.summary.totalPass =
    report.summary.webPass + report.summary.authPass + report.summary.flowPass + report.summary.apiPass;
  report.summary.totalFail = report.summary.totalChecks - report.summary.totalPass;

  mkdirSync(join(ROOT, "docs"), { recursive: true });
  writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
  writeFileSync(REPORT_MD, buildMarkdown(report), "utf8");

  const status = report.summary.totalFail === 0 ? "PASS" : "FAIL";
  console.log(`Phase 16-30 Full Check: ${status}`);
  console.log(`Web: ${report.summary.webPass}/${report.summary.webTotal}`);
  console.log(`Auth: ${report.summary.authPass}/${report.summary.authTotal}`);
  console.log(`Flow: ${report.summary.flowPass}/${report.summary.flowTotal}`);
  console.log(`API Routes: ${report.summary.apiPass}/${report.summary.apiTotal}`);
  console.log(`Report JSON: ${relative(ROOT, REPORT_JSON)}`);
  console.log(`Report MD: ${relative(ROOT, REPORT_MD)}`);

  if (report.summary.totalFail > 0) {
    process.exitCode = 1;
  }
}

function buildMarkdown(report) {
  const lines = [];
  lines.push("# Phase 16-30 Final Check Report");
  lines.push("");
  lines.push(`- Started: ${report.startedAt}`);
  lines.push(`- Completed: ${report.completedAt}`);
  lines.push(`- API Base: \`${report.apiBase}\``);
  lines.push(`- Web Base: \`${report.webBase}\``);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Total checks: **${report.summary.totalChecks}**`);
  lines.push(`- Passed: **${report.summary.totalPass}**`);
  lines.push(`- Failed: **${report.summary.totalFail}**`);
  lines.push(`- Web: ${report.summary.webPass}/${report.summary.webTotal}`);
  lines.push(`- Auth: ${report.summary.authPass}/${report.summary.authTotal}`);
  lines.push(`- Flow: ${report.summary.flowPass}/${report.summary.flowTotal}`);
  lines.push(`- API routes: ${report.summary.apiPass}/${report.summary.apiTotal}`);
  lines.push("");

  if (report.failures.length) {
    lines.push("## Failures");
    lines.push("");
    for (const failure of report.failures) {
      const method = failure.method ? `${failure.method} ` : "";
      const route = failure.route || failure.key || failure.email || failure.resolvedPath || "unknown";
      lines.push(`- ${method}${route} -> status ${failure.status}`);
    }
    lines.push("");
  } else {
    lines.push("## Failures");
    lines.push("");
    lines.push("- None");
    lines.push("");
  }

  lines.push("## Context IDs Used");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(report.context, null, 2));
  lines.push("```");
  lines.push("");

  return lines.join("\n");
}

run().catch((error) => {
  console.error("Phase 16-30 full check failed:", error);
  process.exit(1);
});
