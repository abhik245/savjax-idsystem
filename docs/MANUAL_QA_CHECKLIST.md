# SAVJAX Manual QA Checklist

Use this after starting:

- `apps/api` on `http://localhost:4000/api/v2`
- `apps/web` on `http://localhost:3000`

## 1. Login and session checks

- Open `http://localhost:3000/login`
- Login as `main.admin@demo.com / Admin@123`
- Confirm dashboard loads and refresh still keeps the session
- Logout and confirm redirect back to `/login`
- Repeat login for:
  - `company.admin@demo.com / Admin@123`
  - `sales@demo.com / Admin@123`
  - `printer@demo.com / Admin@123`
  - `school.admin@demo.com / Admin@123`
  - `school.staff@demo.com / Admin@123`

## 2. Parent OTP flow

- Open `http://localhost:3000/parent/intake?token=demo-school-2026`
- Enter mobile `9000000001`
- Enter OTP `123456`
- Submit one student record
- Confirm submission completes
- Use `Add one more student`
- Confirm the second student can be added

## 3. Super admin dashboard

- Open `Dashboard`
- Confirm KPIs, charts, and summary widgets load
- Open `Schools`
- Confirm seeded schools are visible
- Open `Users`
- Confirm employee list loads
- Open `Templates`
- Confirm school context picker works
- Open `Workflow`
- Confirm workflow list loads
- Open `Print Ops`
- Confirm print job list loads
- Open `Reports`
- Confirm summary rows load
- Open `Billing`
- Confirm invoices and reconciliation load
- Open `Settings`
- Confirm retention panel loads
- Confirm auth anomaly panel loads
- Confirm protected download/export trail loads
- Confirm masking policy panel loads
- Open `Audit Logs`
- Confirm rows load

## 4. Security settings checks

- In `Settings`, click `Refresh Summary`
- Confirm retention counts load
- Run `Dry Run Purge`
- Confirm result summary appears
- Open `Auth Anomaly Watch`
- Confirm recent events table appears
- Confirm `Protected Downloads & Export Trail` appears
- In `Revoke User Sessions`, pick a test user and revoke sessions
- Confirm success message appears
- Open `Field Masking Policies`
- Select a school
- Save a mask policy
- Confirm the policy appears in the policy list

## 5. School detail drill-down

- Open `Schools`
- Click one school
- Confirm school overview loads
- Confirm students list loads
- Confirm intake link list loads
- Confirm class-wise groupings load if available
- Confirm audit/activity data loads

## 6. Sales scoping

- Login as `sales@demo.com`
- Confirm only assigned schools appear
- Try school drill-down on an assigned school
- Confirm it works
- Confirm unrelated schools are not visible
- Confirm final print artifact actions are not exposed

## 7. School admin scoping

- Login as `school.admin@demo.com`
- Confirm only one school is visible
- Confirm workflow page is scoped to that school
- Confirm settings security admin pages are not globally exposed
- Confirm the school cannot view another school’s detail page

## 8. School staff restriction checks

- Login as `school.staff@demo.com`
- Confirm restricted workspace loads
- Confirm `schools.csv` export is blocked
- Confirm security settings actions are blocked

## 9. Template and render flow

- Login as super admin or school admin
- Open `Templates`
- Select a school context
- Create or open a template
- Add text/photo/QR/barcode elements
- Switch `Front` and `Rear`
- Save layout
- Run preview
- Save assignment
- Generate render batch
- Confirm render batch appears

## 10. Print operations

- Login as `printer@demo.com`
- Open `Print Ops`
- Generate a print artifact if available
- Use `Download Latest`
- Confirm download succeeds
- Use `Export CSV`
- Confirm download succeeds

## 11. Billing checks

- Login as `main.admin@demo.com`
- Open `Billing`
- Create a test invoice if the form is active
- Confirm invoice appears in the list
- Confirm reconciliation summary updates

## 12. Audit checks

- Open `Audit Logs`
- Confirm entries exist for:
  - login activity
  - retention action
  - protected download/export activity
  - mask policy update
  - session revoke
  - template or render activity

## 13. Automated verification

From repo root:

```bash
node ./tools/full-local-verify.mjs
```

Expected:

- API build passes
- API security smoke passes
- API live security HTTP checks pass
- Web build passes
- `tools/phase16_30_full_check.mjs` passes

## 14. If auth checks start failing locally

Run:

```bash
cd apps/api
npm run test:auth:reset
```

Then restart the API server before retrying.
