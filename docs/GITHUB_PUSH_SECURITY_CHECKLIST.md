# GitHub Push Security Checklist

Use this checklist before pushing the SAVJAX repo to a new GitHub repository.

## 1. Do not push local secret files
These files must stay local only:

- `apps/api/.env`
- `apps/web/.env.local`
- any `.env.production`
- AWS credentials files
- local SMS/payment provider keys

Only example/template env files should be tracked:

- `apps/api/.env.example`
- `apps/api/.env.production.example`
- `apps/web/.env.example`
- `apps/web/.env.production.intake.example`
- `apps/web/.env.production.ops.example`

## 2. Do not push local runtime artifacts
These must stay untracked:

- `apps/api/uploads/`
- `apps/api/.generated/`
- `.next/`
- `dist/`
- `node_modules/`

## 3. Run the push-readiness scan
From repo root:

```bash
node tools/push-readiness-check.mjs
```

It will fail if:

- a real `.env` file is tracked
- upload/generated artifact folders are tracked
- common secret/token patterns are detected
- suspicious secret assignments are found in tracked files

## 4. Review tracked files manually
Run:

```bash
git ls-files
git status --short
```

Pay special attention to:

- env files
- migration files
- docs containing copied credentials
- generated PDFs, CSVs, uploads, exports

## 5. Keep production secrets out of GitHub
Store real production values in:

- AWS Secrets Manager
- CI/CD secret store
- deployment platform secret manager

Examples of values that must never be committed:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `FIELD_ENCRYPTION_KEY`
- `ASSET_SIGNING_SECRET`
- `DIGITAL_ID_SECRET`
- `AWS_SECRET_ACCESS_KEY`
- `RAZORPAY_KEY_SECRET`
- SMS provider auth tokens

## 6. If a secret was ever committed, rotate it
Do not assume deleting the file is enough.

If a real secret was committed:

1. rotate the secret immediately
2. replace it in AWS/CI/CD
3. consider rewriting history if the repo was already shared

## 7. Safe push flow
### Recommended for a brand new GitHub repo: fresh-history push
If there is any chance the old local Git history ever contained secrets, use a fresh-history push instead of pushing the full old history.

```bash
git checkout --orphan github-clean
git add .
git commit -m "Initial secure SAVJAX release"
git push <new-repo-url> github-clean:main
```

This keeps the current code but avoids publishing old commit history.

### Standard push flow
Use this only if you are confident the existing Git history is already safe to publish.

After the scan passes:

```bash
git add .
git commit -m "Prepare repo for GitHub and production deployment"
git remote add origin <new-repo-url>
git push -u origin main
```

## 8. Before production deployment
Use:

- [AWS_PHASE1_SECURE_DATA_COLLECTION_LAUNCH.md](/d:/FINAL PROJECT FILE jan 2026/docs/AWS_PHASE1_SECURE_DATA_COLLECTION_LAUNCH.md)
- [AWS_PHASE1_DEPLOYMENT_BLUEPRINT.md](/d:/FINAL PROJECT FILE jan 2026/docs/AWS_PHASE1_DEPLOYMENT_BLUEPRINT.md)
- [AWS_PHASE1_SETUP_ORDER.md](/d:/FINAL PROJECT FILE jan 2026/docs/AWS_PHASE1_SETUP_ORDER.md)

Production deployment must use real secrets from secret management, not repo files.
