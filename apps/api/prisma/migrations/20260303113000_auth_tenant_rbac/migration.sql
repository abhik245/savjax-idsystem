-- Enterprise auth + tenancy hardening
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'Role' AND e.enumlabel = 'COMPANY_ADMIN') THEN
    ALTER TYPE "Role" ADD VALUE 'COMPANY_ADMIN';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'Role' AND e.enumlabel = 'SALES_PERSON') THEN
    ALTER TYPE "Role" ADD VALUE 'SALES_PERSON';
  END IF;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lockoutUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "forcePasswordReset" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "AuthSession"
  ADD COLUMN IF NOT EXISTS "deviceId" TEXT,
  ADD COLUMN IF NOT EXISTS "rotatedFromId" TEXT,
  ADD COLUMN IF NOT EXISTS "revokedReason" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'AuthSession_rotatedFromId_fkey'
  ) THEN
    ALTER TABLE "AuthSession"
      ADD CONSTRAINT "AuthSession_rotatedFromId_fkey"
      FOREIGN KEY ("rotatedFromId") REFERENCES "AuthSession"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "UserSchoolAccess" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "accessLevel" TEXT NOT NULL DEFAULT 'STANDARD',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserSchoolAccess_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SalesAssignment" (
  "id" TEXT NOT NULL,
  "salesPersonId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SalesAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "requestedIp" TEXT,
  "requestedAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'UserSchoolAccess_userId_fkey'
  ) THEN
    ALTER TABLE "UserSchoolAccess"
      ADD CONSTRAINT "UserSchoolAccess_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'UserSchoolAccess_schoolId_fkey'
  ) THEN
    ALTER TABLE "UserSchoolAccess"
      ADD CONSTRAINT "UserSchoolAccess_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'SalesAssignment_salesPersonId_fkey'
  ) THEN
    ALTER TABLE "SalesAssignment"
      ADD CONSTRAINT "SalesAssignment_salesPersonId_fkey"
      FOREIGN KEY ("salesPersonId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'SalesAssignment_schoolId_fkey'
  ) THEN
    ALTER TABLE "SalesAssignment"
      ADD CONSTRAINT "SalesAssignment_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'SalesAssignment_createdById_fkey'
  ) THEN
    ALTER TABLE "SalesAssignment"
      ADD CONSTRAINT "SalesAssignment_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PasswordResetToken_userId_fkey'
  ) THEN
    ALTER TABLE "PasswordResetToken"
      ADD CONSTRAINT "PasswordResetToken_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "UserSchoolAccess_userId_schoolId_key" ON "UserSchoolAccess"("userId", "schoolId");
CREATE INDEX IF NOT EXISTS "UserSchoolAccess_schoolId_idx" ON "UserSchoolAccess"("schoolId");

CREATE UNIQUE INDEX IF NOT EXISTS "SalesAssignment_salesPersonId_schoolId_key" ON "SalesAssignment"("salesPersonId", "schoolId");
CREATE INDEX IF NOT EXISTS "SalesAssignment_schoolId_idx" ON "SalesAssignment"("schoolId");
CREATE INDEX IF NOT EXISTS "SalesAssignment_createdById_idx" ON "SalesAssignment"("createdById");

CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

CREATE INDEX IF NOT EXISTS "AuthSession_userId_idx" ON "AuthSession"("userId");
CREATE INDEX IF NOT EXISTS "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");
CREATE INDEX IF NOT EXISTS "AuthSession_revokedAt_idx" ON "AuthSession"("revokedAt");
CREATE INDEX IF NOT EXISTS "AuthSession_deviceId_idx" ON "AuthSession"("deviceId");
