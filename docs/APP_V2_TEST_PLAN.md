# App V2 Test Plan (Auth + Tenant RBAC)

## 1) Start Backend
```powershell
cd "d:\FINAL PROJECT FILE jan 2026\apps\api"
npm install
copy .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run start:dev
```

## 2) Start Frontend
```powershell
cd "d:\FINAL PROJECT FILE jan 2026\apps\web"
npm install
copy .env.example .env.local
npm run dev
```

## 3) Seed Credentials
- `main.admin@demo.com / Admin@123` (`SUPER_ADMIN`)
- `company.admin@demo.com / Admin@123` (`COMPANY_ADMIN`)
- `sales@demo.com / Admin@123` (`SALES_PERSON`)
- `sales.north@demo.com / Admin@123` (`SALES_PERSON`)
- `printer@demo.com / Admin@123` (`PRINTING`)
- `school.admin@demo.com / Admin@123` (`SCHOOL_ADMIN`)
- `school.staff@demo.com / Admin@123` (`SCHOOL_STAFF`)

## 4) Login + Session Flow
1. Open `http://localhost:3000/login`.
2. Login with each credential above.
3. Confirm API response includes `user`, `permissions`, `assignedSchoolIds`, `accessToken`, `refreshToken`.
4. Confirm `/api/v2/auth/me` returns correct role and scope after login.
5. Refresh page and confirm session remains valid.
6. Logout and confirm refresh token is revoked.

## 5) Tenant Isolation Checks
1. Login as `SALES_PERSON` (`sales@demo.com`).
2. Call `/api/v2/schools` and confirm only assigned schools are returned.
3. Try opening unassigned school detail endpoint (`/api/v2/admin/schools/<other-school-id>/detail`) and confirm `403`.
4. Login as `SCHOOL_ADMIN` and confirm only own `schoolId` is accessible.
5. Login parent through intake OTP and confirm `/api/v2/parent/submissions` only returns own records.

## 6) Provisioning Checks
1. Login as `SUPER_ADMIN`.
2. Open `http://localhost:3000/dashboard/access`.
3. Create a company employee (`SALES_PERSON`).
4. Create a school user (`SCHOOL_ADMIN` or `SCHOOL_STAFF`).
5. Create sales assignment.
6. Confirm entries appear in list and audit logs are written.

## 7) Parent OTP Flow (Mobile/Desktop)
1. Open school intake link (`/parent/intake?token=<intake_token>`).
2. Send OTP, use `DEV_MASTER_OTP` from backend env (default `123456`).
3. Verify OTP, submit student with photo capture.
4. Confirm new record appears in school/student views and parent portal (`/parent/portal`).

## 8) Security Regression Checklist
- Invalid password increments failure count and eventually locks account.
- `/api/v2/auth/refresh` rotates refresh tokens (old one no longer valid).
- `403` for any school cross-tenant access attempt.
- Audit entries exist for login/logout/password reset/user role change/sales assignment changes.
- No endpoint returns `parentSubmissions.payloadJson` in overview endpoints.
