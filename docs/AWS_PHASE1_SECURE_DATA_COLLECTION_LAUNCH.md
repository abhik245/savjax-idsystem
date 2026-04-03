# AWS Phase 1 Secure Data Collection Launch

## Objective
Phase 1 is not the full SAVJAX platform launch.

Phase 1 should launch only the minimum secure scope required for:

- institution and link creation by SAVJAX internal operators
- parent/student/employee data collection
- photo upload/capture
- secure storage of submitted records

Do not expose the full workflow, print, billing, or broad admin surface publicly in this phase unless there is a direct operational reason.

## Hard Rule
For Phase 1, the public internet should reach only the collection surface and only the minimum auth endpoints needed for it.

Everything else should be:

- private behind VPN / IP allowlist, or
- reachable only by authenticated internal users through restricted origins

## What Should Be Public In Phase 1
These are the only endpoints that should be considered internet-facing for collection:

- `GET /api/v2/intake-links/token/:token`
- `POST /api/v2/auth/parent/send-otp`
- `POST /api/v2/auth/parent/verify-otp`
- `POST /api/v2/parent/photo/analyze`
- `POST /api/v2/parent/submissions`
- `GET /api/v2/auth/me` only for already established parent session checks

If you use student self-intake or employee self-intake in the same phase, the equivalent campaign-token and self-submission routes can also be public, but only for that exact intake flow.

## What Should Not Be Public In Phase 1
Do not expose these to the open internet without additional access restriction:

- internal admin dashboards
- employee directory endpoints
- school detail/admin drill-down endpoints
- audit log endpoints
- print job and artifact generation endpoints
- render batch export endpoints
- billing and reconciliation endpoints
- platform retention controls
- security anomaly/event feeds
- workflow rule management endpoints

If internal staff need them remotely, place them behind:

- VPN, or
- AWS WAF IP allowlist, or
- CloudFront / ALB auth layer plus very strict origin and session control

## Recommended AWS Architecture For Phase 1
Use this shape:

1. Route 53
2. CloudFront
3. AWS WAF attached to CloudFront
4. ALB with HTTPS only
5. Web and API on ECS Fargate or tightly managed EC2
6. RDS PostgreSQL in private subnets
7. S3 private bucket for uploads
8. KMS for encryption keys
9. Secrets Manager for runtime secrets
10. CloudTrail + GuardDuty + CloudWatch alarms

## Network Layout
- Public subnets:
  - ALB only
- Private app subnets:
  - API containers / instances
  - web server if not served fully through static/CDN pattern
- Private data subnets:
  - RDS PostgreSQL
  - Redis if introduced

Security groups:
- ALB accepts `443` from internet
- app accepts only from ALB security group
- DB accepts only from app security group
- do not expose database, Redis, or admin services publicly

## TLS and HTTPS
- Use ACM-issued certificates on the ALB or CloudFront
- Redirect all HTTP to HTTPS
- keep HSTS enabled in production
- do not allow any mixed-content photo or asset loading

## Secrets
Move these out of `.env` files on servers and into AWS Secrets Manager:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `FIELD_ENCRYPTION_KEY`
- `ASSET_SIGNING_SECRET`
- `DIGITAL_ID_SECRET`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- any SMS provider credentials

Do not store production secrets in:

- GitHub
- EC2 user-data scripts
- frontend env
- copied `.env` files on personal laptops

## Current Production Blockers You Should Not Ignore
These are the main blockers for a secure real launch:

1. Parent OTP delivery is not production-complete until a real SMS provider is integrated.
   - In production, the app already stops using the dev OTP and generates a random OTP.
   - If no SMS provider is wired, users will not receive it.

2. Local disk uploads are not the right long-term production storage for identity photos.
   - Use private S3 with server-side encryption instead.

3. Internal admin and operations routes should not be open to the world in Phase 1.
   - Restrict them separately from public intake traffic.

## S3 / Asset Rules
For Phase 1:

- bucket must be private
- S3 Block Public Access must stay enabled
- enable server-side encryption
- store photos by institution/campaign/record path
- never expose raw bucket URLs
- serve protected assets only through signed brokered access

Example path pattern:

- `tenant/<tenant-id>/school/<school-id>/campaign/<campaign-id>/photos/<record-id>.jpg`

## WAF Rules To Enable Immediately
At minimum on CloudFront or ALB:

1. Rate-based rule for OTP send
2. Rate-based rule for OTP verify
3. Rate-based rule for intake token probing
4. Managed protection rules for common web exploits
5. Optional geo restriction if your launch region is known

You are protecting against:

- OTP brute force
- token enumeration
- bot abuse
- noisy scans against auth and upload endpoints

## Cookie and Session Rules
In production:

- `AUTH_COOKIE_SECURE=true`
- `TRUST_PROXY=true`
- `AUTH_DEV_EXPOSE_OTP=false`
- `AUTH_DEV_EXPOSE_RESET_TOKEN=false`
- `DEV_MASTER_OTP` must be empty
- `CORS_ORIGIN` must list only the real frontend domains

The API now refuses to boot in production if these are unsafe.

## Data Collection Phase Policy
This is the safest way to launch Phase 1:

### Public surface
- parent intake link
- OTP send / verify
- photo analysis
- submission endpoint

### Internal-only surface
- school creation
- campaign/link creation
- view submitted data
- export/reporting
- template management
- audit logs

That split keeps your most dangerous admin endpoints off the open internet while you validate collection quality.

## Database Protection
- RDS PostgreSQL in private subnets only
- encryption at rest enabled
- automated backups enabled
- snapshot encryption enabled
- deletion protection enabled
- separate production DB from staging DB
- do not reuse demo seed data in production

## Logging and Monitoring
Enable and watch:

- CloudTrail
- GuardDuty
- CloudWatch alarms
- ALB access logs
- WAF logs

Create alerts for:

- repeated OTP send failures
- repeated OTP verify failures
- large bursts on intake token routes
- excessive 401/403 spikes
- large upload error spikes
- sudden export/download activity

## IAM Discipline
- app runtime role should access only what it needs
- separate roles for app, deployment, backup, and support access
- no long-lived root or admin access keys
- prefer role-based access over static credentials

## Phase 1 Go-Live Checklist
Before launch, all of this should be true:

1. production domain is ready with HTTPS
2. WAF is attached and rate limits are in place
3. internal admin routes are not broadly public
4. RDS is private and encrypted
5. S3 is private and encrypted
6. secrets are in Secrets Manager
7. dev OTP exposure is fully disabled
8. real SMS delivery for OTP is integrated
9. production seed/demo credentials are removed
10. CloudTrail and GuardDuty are enabled
11. backup restore has been tested
12. audit logs are retained and reviewed

## Recommended Rollout Sequence
### Stage 1
Launch only:

- institution creation by SAVJAX team
- intake link creation
- parent/public data collection
- secure storage

### Stage 2
Enable:

- internal review
- school-side verification
- exception correction workflow

### Stage 3
Enable:

- template binding
- render previews
- print batches

### Stage 4
Enable:

- billing
- digital ID
- production automation

## Practical Recommendation
Do not launch everything at once.

For the first real AWS go-live, treat SAVJAX as a secure intake platform first.
That means the main success metric is:

- links can be created safely
- data can be collected safely
- photos can be uploaded safely
- no cross-tenant leakage occurs
- no admin surface is casually exposed

That is the right first production milestone.

## Official AWS References
- AWS WAF rate-based rules: https://docs.aws.amazon.com/waf/latest/developerguide/waf-rule-statement-type-rate-based.html
- S3 Block Public Access: https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html
- RDS encryption at rest: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Overview.Encryption.html
- AWS Secrets Manager best practices: https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html
- CloudTrail: https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-user-guide.html
- GuardDuty: https://docs.aws.amazon.com/guardduty/latest/ug/what-is-guardduty.html
- ACM certificates: https://docs.aws.amazon.com/acm/latest/userguide/acm-services.html
