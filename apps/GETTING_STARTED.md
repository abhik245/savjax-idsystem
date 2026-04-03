# Getting Started (Enterprise Stack)

## 1) API (NestJS + Prisma)

```bash
cd apps/api
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run start:dev
```

API base: `http://localhost:4000/api/v2`

Production-safe notes:
- keep `NODE_ENV=development` locally
- in production, set strong real values for `JWT_ACCESS_SECRET`, `FIELD_ENCRYPTION_KEY`, `ASSET_SIGNING_SECRET`, and `DIGITAL_ID_SECRET`
- in production, `AUTH_COOKIE_SECURE=true` and `TRUST_PROXY=true`
- in production, remove `DEV_MASTER_OTP` and do not use localhost origins in `CORS_ORIGIN`

## 2) Web (Next.js)

```bash
cd apps/web
npm install
cp .env.example .env.local
npm run dev
```

Web app: `http://localhost:3000/login`

Optional local dev setting for parent OTP display:

```bash
NEXT_PUBLIC_EXPOSE_DEV_OTP=true
```

Keep this `false` in staging/production-facing environments.

Optional local dev auth hints:

```bash
NEXT_PUBLIC_EXPOSE_DEV_AUTH_HINTS=true
AUTH_DEV_EXPOSE_RESET_TOKEN=true
```

Keep both disabled outside local development.

## GitHub push safety

Before pushing this repo to GitHub, run from repo root:

```bash
node tools/push-readiness-check.mjs
```

Use the full checklist here:

- [docs/GITHUB_PUSH_SECURITY_CHECKLIST.md](/d:/FINAL PROJECT FILE jan 2026/docs/GITHUB_PUSH_SECURITY_CHECKLIST.md)

## Seeded credentials
- `main.admin@demo.com / Admin@123`
- `company.admin@demo.com / Admin@123`
- `sales@demo.com / Admin@123`
- `printer@demo.com / Admin@123`
- `school.admin@demo.com / Admin@123`
- `school.staff@demo.com / Admin@123`

Parent OTP (dev): `123456`

## Security Verification

From `apps/api`:

```bash
npm run test:security
npm run test:security:http
```

What they cover:
- service/helper security smoke checks
- env validation checks
- public-link throttling checks
- live cookie-auth role checks against the running API
- tenant isolation checks for sales and school roles
- export restriction checks

## Reset local auth state

If repeated local test runs start hitting login throttles or seeded accounts get locked:

```bash
cd apps/api
npm run test:auth:reset
```

Then restart the API dev server to clear in-memory rate-limit windows:

```bash
npm run start:dev
```

## Full Phase 16-30 Verification

From workspace root:

```bash
node ./tools/phase16_30_full_check.mjs
```

One-command build + security + route verification:

```bash
node ./tools/full-local-verify.mjs
```

What it does:
- rebuilds `apps/api`
- restarts the API on `:4000`
- rebuilds `apps/web`
- restarts the web dev server on `:3000`
- runs security smoke checks
- resets local auth/OTP state for deterministic route verification
- reruns the full route sweep
- reruns the live HTTP security checks

Reports generated:
- `docs/PHASE_16_30_FINAL_CHECK_REPORT.json`
- `docs/PHASE_16_30_FINAL_CHECK_REPORT.md`

Manual checklist:
- `docs/MANUAL_QA_CHECKLIST.md`

Security operations in dashboard:
- Login as `SUPER_ADMIN`, `COMPANY_ADMIN`, `OPERATIONS_ADMIN`, or `HR_ADMIN`
- Open `Dashboard > Settings`
- Review:
  - retention controls
  - auth anomaly watch
  - protected download and export trail
  - session revocation
  - field masking policies
