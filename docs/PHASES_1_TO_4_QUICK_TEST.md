# SAVJAX V2.1 - Phase 1 to 6 Quick Test

## Implemented Scope

- Phase 1: Multi-track intake campaign foundation
  - `InstitutionType`: `SCHOOL | COLLEGE | COMPANY`
  - Campaign fields on intake link: audience, sibling toggle, draft toggle, photo policy, payment toggle, form schema, template assignment.
  - Alias routes added: `/campaigns` and `/schools/:schoolId/campaigns`.
- Phase 2: AI photo intelligence pipeline
  - Server-side photo validation and normalization path.
  - Optional AWS Rekognition face check (config-driven).
  - Local fallback heuristics when AWS is disabled/unavailable.
- Phase 3: Review and correction console APIs
  - Review queue endpoint with duplicate and stage filtering.
  - Correction endpoint with reason trail.
  - Correction history stored in `CorrectionLog`.
- Phase 4: Template auto-binding backend
  - Template create endpoint.
  - Mapping update endpoint with snapshot versioning.
  - Proof preview rebind propagation on template mapping updates.
- Phase 5: Configurable approval chains
  - School/college/company chain configuration with ordered role steps.
  - Workflow start endpoint per student.
  - Approve / reject / send-back / comment actions with history.
  - Bulk action endpoint for partial batch operations.
- Phase 6: Print production engine
  - Production-ready gating on print dispatch.
  - Print batch controls (batch code, layout metadata, assignee checks).
  - Artifact generation + CSV export.
  - Status progression: READY -> PRINTING -> PRINTED -> DISPATCHED.
  - Reissue request + reprint batch flow.

Also added:
- Razorpay payment flow (order create, verify signature, payment ledger)
- Payment ledger table integrated with invoice reconciliation.

---

## New/Updated Environment Variables (`apps/api/.env`)

```env
PHOTO_MAX_MB=40
LOCAL_UPLOAD_DIR=uploads

AWS_REKOGNITION_ENABLED=false
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_SESSION_TOKEN=
AWS_REGION=ap-south-1

RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```

---

## Database Steps

From `apps/api`:

```bash
npm run prisma:generate
npm run prisma:migrate -- --name phase_1_4_foundation
npm run prisma:seed
```

Seed includes campaign tokens:
- `demo-school-2026` (parent flow)
- `demo-college-2026` (student flow campaign config)
- `demo-company-2026` (employee flow campaign config)

---

## API Endpoints Added/Extended

## Campaign Engine (Phase 1)

- `POST /api/v2/schools/:schoolId/campaigns`
- `GET /api/v2/campaigns?schoolId=...`
- `GET /api/v2/campaigns/token/:token`

Existing intake link routes continue to work.

## Photo Intelligence (Phase 2)

- Parent submit now runs server-side photo intelligence automatically:
  - `POST /api/v2/parent/submissions`
- Dedicated pre-submit photo analysis endpoint:
  - `POST /api/v2/parent/photo/analyze`
  - returns `analysisId`, quality score, warnings, normalized `photoKey`
  - `analysisId` is consumed at submit time to avoid duplicate heavy processing.

## Review + Correction (Phase 3)

- `GET /api/v2/admin/review-queue?schoolId=&intakeStage=&duplicateOnly=true&q=&page=&pageSize=`
- `PATCH /api/v2/admin/students/:studentId/correction`
- `GET /api/v2/admin/students/:studentId/corrections`
- `POST /api/v2/admin/students/:studentId/validate`
- `POST /api/v2/admin/students/:studentId/photo-replace`
- `POST /api/v2/admin/students/:studentId/merge-duplicate`
- `POST /api/v2/admin/students/:studentId/handoff`

## Template Auto-Binding (Phase 4)

- `POST /api/v2/admin/schools/:schoolId/templates`
- `GET /api/v2/admin/schools/:schoolId/templates`
- `GET /api/v2/admin/templates/:templateId`
- `POST /api/v2/admin/templates/:templateId/activate`
- `PATCH /api/v2/admin/templates/:templateId/mapping`
- `GET /api/v2/admin/templates/:templateId/snapshots`
- `POST /api/v2/admin/templates/:templateId/render-preview`
- `POST /api/v2/admin/templates/:templateId/bind-campaign`
- `POST /api/v2/admin/templates/:templateId/rebind-proofs`
- `GET /api/v2/admin/template-tokens`

## Configurable Approval Chains (Phase 5)

- `GET /api/v2/admin/schools/:schoolId/approval-chains?institutionType=`
- `POST /api/v2/admin/schools/:schoolId/approval-chains`
- `POST /api/v2/admin/approval-chains/:chainId/activate`
- `GET /api/v2/admin/approval-workflows?schoolId=&status=&studentId=&chainId=&page=&pageSize=`
- `GET /api/v2/admin/approval-workflows/:workflowId`
- `POST /api/v2/admin/students/:studentId/approval-workflow/start`
- `POST /api/v2/admin/approval-workflows/:workflowId/actions`
- `POST /api/v2/admin/approval-workflows/bulk-actions`

## Print Production Engine (Phase 6)

- `POST /api/v2/admin/print-jobs/dispatch`
- `GET /api/v2/admin/print-jobs`
- `GET /api/v2/admin/print-jobs/:printJobId`
- `PATCH /api/v2/admin/print-jobs/:printJobId/status`
- `POST /api/v2/admin/print-jobs/:printJobId/generate-artifact`
- `GET /api/v2/admin/print-jobs/:printJobId/export.csv`
- `POST /api/v2/admin/print-jobs/:printJobId/mark-issued`
- `POST /api/v2/admin/students/:studentId/reissue-request`
- `POST /api/v2/admin/print-jobs/reprint`

## Razorpay + Billing

- `POST /api/v2/billing/razorpay/order`
- `POST /api/v2/billing/razorpay/verify`
- `GET /api/v2/billing/payments?schoolId=&invoiceId=`

---

## Quick Validation Flow

1. Login as `main.admin@demo.com / Admin@123`.
2. Create campaign from school:
   - `institutionType=SCHOOL`
   - `audience=PARENT`
   - `allowSiblings=true`
3. Open parent intake link and submit student with photo.
4. Check review queue:
   - duplicate filters and intake stage filters.
5. Apply correction on one student:
   - verify `CorrectionLog` entry created.
6. Create template and update mapping:
   - verify snapshots increment and proofs rebind count.
7. Create/activate approval chain and start workflow on a student:
   - approve one step, send back another, reject another and verify action history.
8. Run bulk approval action with subset of workflows:
   - verify partial success/failure summary is returned.
9. Dispatch production-ready student to print batch:
   - generate artifact and move through `PRINTING -> PRINTED -> DISPATCHED`.
10. Mark batch as issued, raise reissue request, create reprint batch:
   - verify `isReprint=true` and new batch code.
11. Create invoice, create Razorpay order, verify payment signature:
   - verify `PaymentLedger` row and invoice `amountPaid/status` update.

---

## Notes

- AWS Rekognition call is optional and guarded by env config.
- If Razorpay keys are missing, order endpoint returns `mode: "mock"` for local testing.
- Tenant/RBAC checks remain enforced through existing guards and `AccessControlService`.
