# AWS Phase 1 Deployment Blueprint

## Purpose
This blueprint is the exact Phase 1 deployment shape for the current SAVJAX repo.

It is designed for:

- secure intake link usage
- parent/student/employee data submission
- secure photo upload/capture
- operator-side link creation and monitoring

It is intentionally not the full public launch of all modules.

## Core Assumptions (Challenged)
The following assumptions are rejected for Phase 1:

- "Phase 1 can be simpler". Incorrect. Early architecture decisions become permanent and security shortcuts compound.
- "AWS default configs are safe enough". Incorrect. Default AWS is permissive unless explicitly restricted.
- "App-level auth is sufficient". Incorrect. Network-layer isolation is mandatory.
- "We can fix later". Incorrect. Migration under live institutional load is operationally risky.

These are not philosophical notes. They are deployment constraints.

## Important Repo Constraint
The current Next.js app uses a single build-time `NEXT_PUBLIC_API_BASE`.

That means the safest production deployment is:

- two web deployments from the same codebase
- two API deployments from the same codebase
- same database and same core logic
- different public surfaces and ingress controls

This gives you a hard separation between public collection traffic and internal operator traffic without rewriting the app first.

## Non-Negotiable Phase 1 Deployment Model
You will deploy exactly these four surfaces in Phase 1:

| Surface | Purpose | Exposure |
|---|---|---|
| intake web | public form and collection UX | internet |
| intake API | minimum intake endpoints only | internet, but tightly restricted |
| ops web | dashboard, admin, operator workflows | restricted |
| ops API | internal logic and sensitive operations | restricted |

This split is non-negotiable.

## Recommended Domains

### Public
- `intake.savjax.com`
- `api-intake.savjax.com`

### Internal / operator
- `ops.savjax.com`
- `api-ops.savjax.com`

## Recommended Runtime Topology

### Preferred
- `Route 53`
- `CloudFront`
- `AWS WAF`
- `ALB`
- `ECS Fargate`
- `RDS PostgreSQL`
- `S3 private bucket`
- `Secrets Manager`
- `KMS`
- `CloudTrail`
- `GuardDuty`
- `CloudWatch`

### Fastest acceptable if you need lower infra work right now
- same domain layout
- same network split
- private EC2 app servers behind ALB instead of ECS Fargate

## Exact Service Split

### 1. Public Intake Web
Deployment name:
- `savjax-web-intake`

Purpose:
- serves parent/student/employee intake routes only

Domain:
- `https://intake.savjax.com`

API target:
- `https://api-intake.savjax.com/api/v2`

### 2. Internal Ops Web
Deployment name:
- `savjax-web-ops`

Purpose:
- serves login, dashboard, schools, templates, workflow, print ops, billing, reports

Domain:
- `https://ops.savjax.com`

API target:
- `https://api-ops.savjax.com/api/v2`

### 3. Public Intake API
Deployment name:
- `savjax-api-intake`

Purpose:
- only handles public collection traffic

Important:
- this should expose only the minimum route set through ingress allowlisting

### 4. Internal Ops API
Deployment name:
- `savjax-api-ops`

Purpose:
- handles internal admin/operator workflows

Access:
- protected with VPN or WAF IP allowlist

## Architecture Diagram

```text
                         Internet
                            |
                 +----------------------+
                 |      Route 53        |
                 +----------------------+
                    |                |
                    |                |
        +------------------+   +------------------+
        | intake.savjax... |   |  ops.savjax...   |
        +------------------+   +------------------+
                    |                |
              CloudFront         CloudFront
                    |                |
                 AWS WAF          AWS WAF
                    |                |
                    +-------+--------+
                            |
                           ALB
            +---------------+----------------+
            |                                |
   public intake target groups      internal ops target groups
            |                                |
   savjax-web-intake                  savjax-web-ops
   savjax-api-intake                  savjax-api-ops
            |                                |
            +---------------+----------------+
                            |
                    private app subnets
                            |
              +-----------------------------+
              | RDS PostgreSQL private only |
              +-----------------------------+
                            |
              +-----------------------------+
              | S3 private uploads/artifacts|
              +-----------------------------+
```

## Public API Allowlist
Only these routes should be reachable through `api-intake.savjax.com`:

- `GET /api/v2/intake-links/token/:token`
- `POST /api/v2/auth/parent/send-otp`
- `POST /api/v2/auth/parent/verify-otp`
- `POST /api/v2/parent/photo/analyze`
- `POST /api/v2/parent/submissions`
- `GET /api/v2/auth/me`

Everything else should return `403` or be blocked before it reaches the application.

This restriction must be enforced at ingress or proxy level, not only inside the app.

## Internal API Surface
`api-ops.savjax.com` can expose the full authenticated internal surface, but it should still be restricted by:

- VPN, or
- strict WAF IP allowlist, or
- corporate access control

## Strong Recommendation For Public API Gating
Do not rely only on in-app RBAC for public-exposed hosts.

Use a proxy or gateway allowlist on the public intake API host.

That means:
- public intake host forwards only approved intake routes
- all other paths are denied at the edge/proxy layer

This materially reduces attack surface.
This is a mandatory control for Phase 1, not an optional optimization.

## Network Design

### Public subnets
- ALB only
- optionally NAT gateway if needed for private subnet outbound access

### Private app subnets
- web containers/instances
- API containers/instances

### Private data subnets
- PostgreSQL
- Redis later if introduced

## Security Groups

### ALB SG
- allow inbound `443` from internet
- allow outbound to web/api target groups

### App SG
- allow inbound only from ALB SG
- allow outbound to RDS, S3 VPC endpoint, Secrets Manager VPC endpoint, CloudWatch, SMS provider egress

### DB SG
- allow inbound only from app SG

## S3 Layout

Bucket:
- private only
- block public access enabled
- SSE enabled

Suggested key layout:
- `tenant/<tenant-id>/school/<school-id>/campaign/<campaign-id>/photos/<record-id>.jpg`
- `tenant/<tenant-id>/school/<school-id>/render-batches/<batch-id>/...`
- `tenant/<tenant-id>/school/<school-id>/print-jobs/<job-id>/...`

## CloudFront / WAF Strategy

### Intake distribution
Protect with:
- rate-based rule for OTP send
- rate-based rule for OTP verify
- rate-based rule for token probing
- AWS managed common rule set
- bot control later if needed

### Ops distribution
Protect with:
- AWS managed common rule set
- IP allowlist
- optional geo restriction
- stricter rate limits

## TLS
- ACM cert for `intake.savjax.com`
- ACM cert for `ops.savjax.com`
- ACM cert for API domains
- force HTTPS
- no HTTP-only listeners in final state

## Logging

Enable:
- ALB access logs
- WAF logs
- CloudTrail
- GuardDuty
- application logs with request IDs
- CloudWatch alarms

## Phase 1 Deployment Decision
For the safest first launch with the least code churn:

Deploy four runtime surfaces:

1. public intake web
2. public intake API
3. internal ops web
4. internal ops API

All four can run the same codebase, but the ingress and runtime env must differ.
