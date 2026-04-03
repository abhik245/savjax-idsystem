# Phase 7-15 Final Output (Local Run + Validation)

## 1) Start Backend (NestJS API)
```powershell
cd "d:\FINAL PROJECT FILE jan 2026\apps\api"
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run build
npm run start
```

Backend URL:
- `http://localhost:4000/api/v2`

## 2) Start Frontend (Next.js Web)
```powershell
cd "d:\FINAL PROJECT FILE jan 2026\apps\web"
npm install
npm run build
npm run start
```

Frontend URLs:
- `http://localhost:3000/login`
- `http://localhost:3000/dashboard`
- `http://localhost:3000/parent/intake?intake_token=demo-school-2026`
- `http://localhost:3000/parent/portal`

## 3) Demo Credentials
- `main.admin@demo.com / Admin@123` (`SUPER_ADMIN`)
- `company.admin@demo.com / Admin@123` (`COMPANY_ADMIN`)
- `sales@demo.com / Admin@123` (`SALES_PERSON`)
- `sales.north@demo.com / Admin@123` (`SALES_PERSON`)
- `printer@demo.com / Admin@123` (`PRINTING`)
- `school.admin@demo.com / Admin@123` (`SCHOOL_ADMIN`)
- `school.staff@demo.com / Admin@123` (`SCHOOL_STAFF`)

## 4) Phase 7-15 Backend Features Live

### Security + Governance
- `GET /platform/security/mask-policies`
- `POST /platform/security/mask-policies`
- `GET /platform/security/assets/signed-url`
- `GET /platform/security/assets/:token`
- `GET /platform/security/auth-anomalies`
- `POST /platform/security/revoke-sessions`

### Async Jobs + Scale Ops
- `POST /platform/async-jobs`
- `GET /platform/async-jobs`
- `POST /platform/async-jobs/:jobId/process`

### Enterprise Reports
- `GET /platform/reports/enterprise`

### Digital ID + QR Layer
- `POST /platform/digital-id/generate`
- `GET /platform/digital-id/verify`
- `POST /platform/digital-id/scan`

### Workflow Automation Rules
- `GET /platform/workflow-rules`
- `POST /platform/workflow-rules`
- `PATCH /platform/workflow-rules/:ruleId`
- `POST /platform/workflow-rules/:ruleId/apply`

### Template Color Management
- `POST /platform/templates/color-profile`

All routes are under `http://localhost:4000/api/v2` and protected by JWT + RBAC + tenant scope.

## 5) Quick Smoke Test (PowerShell)
```powershell
$login = Invoke-RestMethod -Uri 'http://localhost:4000/api/v2/auth/login' -Method POST -ContentType 'application/json' -Body '{"email":"main.admin@demo.com","password":"Admin@123"}'
$token = $login.accessToken
$headers = @{ Authorization = "Bearer $token" }

Invoke-RestMethod -Uri 'http://localhost:4000/api/v2/auth/me' -Headers $headers
Invoke-RestMethod -Uri 'http://localhost:4000/api/v2/admin/overview/kpis' -Headers $headers
Invoke-RestMethod -Uri 'http://localhost:4000/api/v2/platform/reports/enterprise' -Headers $headers
```

## 6) Final Output Notes
- API and Web both build successfully.
- New Phase 7-15 migration is applied: `20260310170000_phase_7_15_enterprise_layer`.
- Parent intake supports `token` and `intake_token` query params.
- Request body limit is configured for high-size uploads (`80mb`).
