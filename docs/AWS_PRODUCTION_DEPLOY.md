# AWS Production Deploy

This repo is production-ready on AWS with this split:

- `apps/web` -> AWS Amplify Hosting
- `apps/api` -> Amazon ECS Fargate behind an Application Load Balancer
- database -> Amazon RDS PostgreSQL
- upload storage -> Amazon EFS
- secrets -> AWS Secrets Manager

## Why this shape

The frontend is a Next.js app and fits Amplify well. The backend stores uploaded photos on the filesystem, so it should run on ECS with a persistent EFS mount instead of an ephemeral runtime.

## 1. Create AWS infrastructure

Create these first:

- VPC with public subnets for ALB and private subnets for ECS and RDS
- Amazon RDS PostgreSQL database
- Amazon EFS file system with one access point for uploads
- Amazon ECR repository for the API image
- ECS cluster and Fargate service
- Application Load Balancer
- AWS Amplify app connected to this GitHub repo
- Route 53 records for:
  - `savjax.com`
  - `www.savjax.com`
  - `api.savjax.com`

## 2. API task definition

Use [ecs-task-definition.sample.json](/d:/FINAL%20PROJECT%20FILE%20jan%202026/infra/aws/ecs-task-definition.sample.json) as your starting point.

Important values:

- container name: `nexid-api`
- container port: `4000`
- upload mount path: `/mnt/uploads`
- ALB health check path: `/api/v2/health`

## 3. Production environment

Use [apps/api/.env.production.aws.example](/d:/FINAL%20PROJECT%20FILE%20jan%202026/apps/api/.env.production.aws.example) and [apps/web/.env.production.aws.example](/d:/FINAL%20PROJECT%20FILE%20jan%202026/apps/web/.env.production.aws.example) as templates.

API production rules already enforced by code:

- `AUTH_COOKIE_SECURE=true`
- `TRUST_PROXY=true`
- `AUTH_DEV_EXPOSE_OTP=false`
- `AUTH_DEV_EXPOSE_RESET_TOKEN=false`
- `DEV_MASTER_OTP` must be empty
- `CORS_ORIGIN` must contain only production domains

Refs:

- [apps/api/src/main.ts](/d:/FINAL%20PROJECT%20FILE%20jan%202026/apps/api/src/main.ts)
- [apps/GETTING_STARTED.md](/d:/FINAL%20PROJECT%20FILE%20jan%202026/apps/GETTING_STARTED.md)

## 4. First database setup

Do not run the demo seed in production. [apps/api/prisma/seed.ts](/d:/FINAL%20PROJECT%20FILE%20jan%202026/apps/api/prisma/seed.ts) creates demo accounts and demo records.

For first-time production setup:

```bash
cd apps/api
npm ci
npx prisma generate
npm run migrate:deploy
```

If you want a completely clean production DB, create a fresh empty RDS database first and then run `npm run migrate:deploy`.

## 5. Create the real super-admin

After migrations, create the first production admin:

```bash
cd apps/api
ADMIN_EMAIL='sales@savjax.com' ADMIN_PASSWORD='replace-this-now' ADMIN_NAME='Main Admin' npm run create:super-admin
```

The script is in [apps/api/scripts/create-super-admin.ts](/d:/FINAL%20PROJECT%20FILE%20jan%202026/apps/api/scripts/create-super-admin.ts).

Use your chosen password once for first login, then rotate it immediately.

## 6. API deploy pipeline

This repo now includes:

- [deploy-api-ecs.yml](/d:/FINAL%20PROJECT%20FILE%20jan%202026/.github/workflows/deploy-api-ecs.yml)
- [apps/api/Dockerfile](/d:/FINAL%20PROJECT%20FILE%20jan%202026/apps/api/Dockerfile)

Required GitHub repository variables:

- `AWS_REGION`
- `ECR_REPOSITORY`
- `ECS_CLUSTER`
- `ECS_SERVICE`
- `ECS_TASK_DEFINITION_FAMILY`
- `ECS_CONTAINER_NAME`

Required GitHub repository secret:

- `AWS_DEPLOY_ROLE_ARN`

The workflow uses GitHub OIDC to assume that AWS role, builds the API image, pushes to ECR, and deploys the updated task definition to ECS.

## 7. Web deploy pipeline

This repo now includes:

- [apps/web/amplify.yml](/d:/FINAL%20PROJECT%20FILE%20jan%202026/apps/web/amplify.yml)
- [deploy-web-amplify.yml](/d:/FINAL%20PROJECT%20FILE%20jan%202026/.github/workflows/deploy-web-amplify.yml)

Required GitHub repository variables:

- `AWS_REGION`
- `AMPLIFY_APP_ID`
- `AMPLIFY_BRANCH`

Amplify can also auto-deploy directly from GitHub `main`, but the workflow is included so production release can stay push-driven from the repo side too.

## 8. Domain mapping

Recommended production routing:

- `savjax.com` -> Amplify
- `www.savjax.com` -> Amplify
- `api.savjax.com` -> ALB

Set:

- web `NEXT_PUBLIC_API_BASE=https://api.savjax.com/api/v2`
- API `CORS_ORIGIN=https://savjax.com,https://www.savjax.com`

## 9. Push flow after initial setup

Once AWS is connected and repo variables are in place, your release flow becomes:

```bash
git push origin main
```

That triggers:

- Amplify web deploy for frontend changes
- ECS API deploy for backend changes

## 10. AWS references

- Amplify Next.js SSR: https://docs.aws.amazon.com/amplify/latest/userguide/ssr-amplify-support.html
- Amplify monorepo deploys: https://docs.aws.amazon.com/amplify/latest/userguide/deploy-nextjs-monorepo.html
- RDS PostgreSQL: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_GettingStarted.CreatingConnecting.PostgreSQL.html
- ECS service load balancing: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-load-balancing.html
- ECS with EFS: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/efs-volumes.html
- Secrets Manager: https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html
- Amplify custom domains: https://docs.aws.amazon.com/amplify/latest/userguide/custom-domains.html
