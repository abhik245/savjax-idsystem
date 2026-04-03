# AWS Phase 1 Setup Order

## Goal
This is the exact order your infra/app team should follow to launch the current SAVJAX repo in a secure Phase 1 state.

Phase 1 means:
- public secure data collection only
- private internal ops/admin workflows
- no casual exposure of internal operator routes to the internet

## Mandatory Pre-Read
The following shortcuts are explicitly rejected:

- Do not simplify Phase 1 by merging public intake and internal ops into one public surface.
- Do not rely on AWS defaults for security. Defaults are not your production policy.
- Do not rely only on app-level authentication. Network-layer isolation is mandatory.
- Do not assume you can fix these controls later under live institutional load.

The Phase 1 runtime model is mandatory:
1. intake web = internet
2. intake API = internet, but tightly restricted
3. ops web = restricted
4. ops API = restricted

## Step 1. Reserve domains in Route 53
Create or confirm these records:

- `intake.savjax.com`
- `api-intake.savjax.com`
- `ops.savjax.com`
- `api-ops.savjax.com`

## Step 2. Issue ACM certificates
Create certificates for:

- `intake.savjax.com`
- `api-intake.savjax.com`
- `ops.savjax.com`
- `api-ops.savjax.com`

Use HTTPS only in final traffic paths.

## Step 3. Create the VPC layout
Create:

- public subnets for ALB
- private app subnets for web/api runtimes
- private data subnets for PostgreSQL

Do not place PostgreSQL in public subnets.

## Step 4. Create storage and secrets
Create:

- private S3 bucket for uploads/artifacts
- AWS Secrets Manager entries for production secrets
- KMS encryption keys where required

Enable:
- S3 Block Public Access
- server-side encryption
- versioning if you want safer artifact rollback behavior

## Step 5. Create RDS PostgreSQL
Create an encrypted PostgreSQL instance with:

- private subnet placement
- automated backups enabled
- deletion protection enabled for production
- SG access only from app security group

## Step 6. Package the app
Preferred runtime:
- ECS Fargate

Fastest acceptable runtime:
- private EC2 instances behind ALB

You need four runtime deployments from the same repo:

- `savjax-web-intake`
- `savjax-web-ops`
- `savjax-api-intake`
- `savjax-api-ops`

## Step 7. Create the four runtime surfaces
This step is mandatory. Do not skip it. Do not merge intake and ops for convenience.

Deploy:
1. public intake web
2. public intake API
3. internal ops web
4. internal ops API

The codebase may be shared, but ingress and runtime env must differ.

## Step 8. Apply production environment variables
Use these templates:

- API: [apps/api/.env.production.example](/d:/FINAL PROJECT FILE jan 2026/apps/api/.env.production.example)
- Intake web: [apps/web/.env.production.intake.example](/d:/FINAL PROJECT FILE jan 2026/apps/web/.env.production.intake.example)
- Ops web: [apps/web/.env.production.ops.example](/d:/FINAL PROJECT FILE jan 2026/apps/web/.env.production.ops.example)

Critical production rules:
- no dev OTP exposure
- no localhost CORS
- secure cookies only
- trust proxy enabled
- strong secrets only from secret manager

## Step 9. Configure ingress rules
### Public intake host
Allow only:
- intake web routes
- public intake API allowlist

Public intake API allowlist:
- `GET /api/v2/intake-links/token/:token`
- `POST /api/v2/auth/parent/send-otp`
- `POST /api/v2/auth/parent/verify-otp`
- `POST /api/v2/parent/photo/analyze`
- `POST /api/v2/parent/submissions`
- `GET /api/v2/auth/me`

Deny all non-intake API routes before they hit the app.

### Internal ops host
Restrict by one of:
- VPN
- strict WAF IP allowlist
- corporate secure access layer

## Step 10. Attach WAF
### Intake WAF rules
At minimum:
- AWS managed common rules
- OTP send rate-based rule
- OTP verify rate-based rule
- token probing rate-based rule

### Ops WAF rules
At minimum:
- AWS managed common rules
- IP allowlist
- stricter rate rules

## Step 11. Deploy the database schema
Run in production release pipeline:

```bash
npm run prisma:generate
npm run prisma:migrate deploy
```

Do not use dev migration commands in production.

## Step 12. Disable all demo-only behavior
Before launch, verify all are disabled or empty:

- `DEV_MASTER_OTP`
- `AUTH_DEV_EXPOSE_OTP`
- `AUTH_DEV_EXPOSE_RESET_TOKEN`
- `NEXT_PUBLIC_EXPOSE_DEV_OTP`
- `NEXT_PUBLIC_EXPOSE_DEV_AUTH_HINTS`

## Step 13. Integrate real OTP delivery
Do not launch public intake if users cannot actually receive OTP.

Required:
- production SMS provider
- delivery monitoring
- failure alerts
- retry policy

## Step 14. Move uploads off local disk
For production:
- photo uploads should go to private S3
- generated artifacts should go to private S3 or tightly controlled protected storage
- raw bucket URLs must not be exposed publicly

## Step 15. Run pre-launch tests
Before DNS cutover, verify:

- intake flow works end-to-end
- OTP send/verify works with real SMS
- photos upload successfully
- only public intake endpoints are reachable from public host
- ops host is blocked from non-allowed public traffic
- internal login works from allowed operator network
- secure cookies work through HTTPS
- tenant isolation tests pass
- export restrictions pass
- signed asset access works

## Step 16. Switch DNS
After validation:
- point `intake.savjax.com`
- point `api-intake.savjax.com`
- point `ops.savjax.com`
- point `api-ops.savjax.com`

Use weighted or staged rollout if you want a safer cutover.

## Step 17. Watch first 48 hours aggressively
Monitor:
- WAF blocks
- OTP failures
- intake submission failures
- upload failures
- ALB error rates
- DB connections
- CloudWatch alarms
- unusual access patterns
- denied access events in app logs/audit feed

## Recommended first launch sequence
Launch in this order:

1. internal ops web + internal ops API
2. validate operator workflows privately
3. public intake API behind WAF
4. public intake web
5. small pilot institution
6. then controlled broader rollout

## Phase 1 definition of success
Success is:
- public users can securely submit data
- internal users can operate from restricted surfaces
- sensitive routes are not publicly exposed
- uploads are private
- OTP abuse is rate limited
- tenant boundaries hold
- logs and audit are usable

Success is not "everything is public".
