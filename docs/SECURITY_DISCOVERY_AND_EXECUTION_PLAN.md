# SAVJAX Security Discovery And Execution Plan

## Scope
This note documents the security-first upgrade path for the existing SAVJAX monorepo.

- `apps/api`: NestJS + Prisma
- `apps/web`: Next.js
- Objective: preserve current working flows while materially reducing tenant leakage risk, sensitive data exposure, and production misconfiguration risk.

## Current Verified Foundation
The following already exist and are being preserved:

- role-based login and refresh flow
- parent OTP flow
- access-control service with tenant-aware school scope checks
- template, approval, render batch, print, billing, and reporting modules
- dashboard and parent routes
- seeded demo environment

## Discovery Findings
### Existing strengths
- `AccessControlService.getUserScope()` and `assertSchoolAccess()` already provide a solid scope foundation.
- `TenantScopeGuard` exists and can be extended instead of replaced.
- refresh tokens are already hashed in session storage.
- route grouping by module is mature enough for incremental hardening.

### Primary security gaps identified
1. Parent OTP challenges were too lightweight for production intent.
2. Sensitive parent submission data was duplicated in plaintext `payloadJson`.
3. Admin operational APIs exposed contact/address fields too broadly.
4. Audit and correction logs stored raw old/new payloads with unnecessary personal data.
5. Redaction rules were inconsistent across camelCase and snake_case payloads.
6. API bootstrap security headers and strict validation needed stronger production posture.

## Implemented In This Pass
### 1. OTP hardening foundation
- Added persistent `OtpChallenge` model.
- Moved parent OTP verification away from in-memory-only state.
- OTPs are now stored hashed, expire, and track attempts.
- Prior active OTP challenges are consumed before a new one is issued.

Files:
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260328121500_security_hardening_foundation/migration.sql`
- `apps/api/src/modules/auth/auth.service.ts`

### 2. Sensitive payload protection
- Added `payloadCiphertext` to `ParentSubmission`.
- Raw submission payload is now encrypted before persistence.
- `payloadJson` is reduced to a redacted operational summary.

Files:
- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/parent/parent.service.ts`
- `apps/api/src/common/services/data-protection.service.ts`

### 3. Redaction and masking layer
- Added reusable `DataProtectionService`.
- Supports:
  - AES-256-GCM JSON encryption
  - phone/email/name/address masking
  - recursive payload redaction for logs and API responses
- Redaction now normalizes key names, so both `parentMobile` and `parent_mobile` are protected.

Files:
- `apps/api/src/common/services/data-protection.service.ts`
- `apps/api/src/common/access/access-control.module.ts`

### 4. API bootstrap hardening
- Added secure response headers.
- Added optional trust proxy support.
- Strengthened validation pipe with production `forbidNonWhitelisted`.

Files:
- `apps/api/src/main.ts`

### 5. Admin response and audit sanitization
- School detail views now mask school contact data for print roles.
- Student summary and review queue responses now mask contact/address data by role.
- Audit log and correction log read APIs now sanitize payloads before returning them.
- Update/correction/photo replace/merge/reissue actions now store sanitized audit/correction payloads.

Files:
- `apps/api/src/modules/admin/admin.service.ts`

## Security Model Being Enforced
### Tenant isolation
- Every school-scoped operation must pass through `assertSchoolAccess()` or `resolveScopedSchoolIds()`.
- No client-supplied school context is trusted without actor scope validation.

### Role-aware field visibility
- super admin / company admin / school roles retain operational access
- lower-privilege internal roles receive masked contact/address exposure by default
- audit/history endpoints return sanitized payloads rather than raw personal data

### Public flow constraints
- parent OTP challenges are now stateful, expiring, and attempt-limited
- dev OTP exposure is controlled by explicit env flag

## Migration Strategy
Run after pulling these changes:

```powershell
cd "d:\FINAL PROJECT FILE jan 2026\apps\api"
npx prisma generate
npx prisma migrate dev
```

## Immediate Next Hardening Steps
1. Add field-level encryption strategy for selected stored student/parent fields.
2. Restrict protected asset access to signed download flows only.
3. Add rate limiting and anomaly tracking for auth/public endpoints.
4. Add automated authorization tests for:
   - tenant isolation
   - school isolation
   - parent flow abuse resistance
   - export restrictions
5. Separate demo-only defaults from production-safe startup configuration.

## Remaining Risks
- Existing historical audit/correction rows created before this pass may still contain unsanitized payloads in the database.
- Local file-based asset storage remains higher risk than private object storage with signed URLs.
- Some render/template operations still necessarily touch sensitive card data and need a later field-by-field access review.

## Success Criteria For This Phase
- Existing routes continue to work.
- Sensitive raw parent intake payload is no longer stored only in plaintext JSON.
- OTP handling is materially stronger than demo-only memory state.
- Admin APIs expose less personal data by default.
- Logs and audit trails remain useful without casually leaking raw personal records.
