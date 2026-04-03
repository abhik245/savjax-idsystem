# Auth + RBAC Go-Live Checklist

## Environment
- `DATABASE_URL` points to production Postgres.
- `JWT_ACCESS_SECRET` is a strong random secret (64+ chars).
- `CORS_ORIGIN` is a strict comma-separated allowlist.
- `AUTH_COOKIE_SECURE=true` in production.
- `AUTH_COOKIE_SAME_SITE=lax` (or `none` only behind HTTPS).
- `ENFORCE_ADMIN_MFA=true` for `SUPER_ADMIN`/`COMPANY_ADMIN`.

## Database
- Run Prisma migration on production DB.
- Run seed only on staging/demo environments.
- Confirm `AuthSession`, `SalesAssignment`, `UserSchoolAccess`, `PasswordResetToken` tables exist.

## Security
- Disable all demo credentials before public launch.
- Confirm brute-force lockout works on failed login attempts.
- Confirm refresh token rotation and revocation on logout.
- Confirm password reset token expiry/one-time usage.

## Tenant Isolation
- `SALES_PERSON` can only access assigned schools.
- `SCHOOL_ADMIN` and `SCHOOL_STAFF` can access only own school.
- `PARENT` can access only own submissions.
- `SUPER_ADMIN` has global visibility.

## Audit Coverage
- Verify audit logs for:
  - login success/failure
  - logout
  - token refresh
  - password reset request/completion
  - user role changes
  - sales assignment create/delete
  - school/student updates

## Smoke Test URLs
- Login: `http://localhost:3000/login`
- Dashboard: `http://localhost:3000/dashboard`
- Access management: `http://localhost:3000/dashboard/access`
- Parent intake: `http://localhost:3000/parent/intake?token=<TOKEN>`
- Parent portal: `http://localhost:3000/parent/portal`
- API health check route example: `http://localhost:4000/api/v2/auth/me` (with auth token)
