# Phase 16-30 Final Output (Full Route-Checked Website)

## What Phase 16-30 covers

This release focuses on enterprise stabilization and full verification:

1. Full web route validation (`/`, `/login`, `/dashboard`, parent routes).
2. Full auth matrix validation for seeded roles.
3. Parent OTP + submission flow verification.
4. API route sweep for all controller routes in `apps/api/src/modules/**`.
5. Tenant isolation assertions (sales/school out-of-scope access must be `403`).
6. Final machine-generated verification report.

## How to run full check

### 1) Start API

```powershell
cd "d:\FINAL PROJECT FILE jan 2026\apps\api"
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run build
npm run start
```

### 2) Start Web

```powershell
cd "d:\FINAL PROJECT FILE jan 2026\apps\web"
npm install
npm run build
npm run start
```

### 3) Run Phase 16-30 full checker

From workspace root:

```powershell
cd "d:\FINAL PROJECT FILE jan 2026"
node .\tools\phase16_30_full_check.mjs
```

## Output files

- JSON report: `docs/PHASE_16_30_FINAL_CHECK_REPORT.json`
- Markdown report: `docs/PHASE_16_30_FINAL_CHECK_REPORT.md`

If any route returns an unexpected server failure (`500`), the checker exits with non-zero status.

