-- Version 2.0: Super Admin overview analytics + enterprise metadata

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'HR_ADMIN';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PRINT_OPS';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'FINANCE';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SCHOOL_STAFF';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SchoolStatus') THEN
    CREATE TYPE "SchoolStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ApprovalRequestType') THEN
    CREATE TYPE "ApprovalRequestType" AS ENUM ('DATA_AND_DESIGN_APPROVAL');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ApprovalRequestStatus') THEN
    CREATE TYPE "ApprovalRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "name" TEXT;

ALTER TABLE "School"
  ADD COLUMN IF NOT EXISTS "city" TEXT,
  ADD COLUMN IF NOT EXISTS "state" TEXT,
  ADD COLUMN IF NOT EXISTS "principalName" TEXT,
  ADD COLUMN IF NOT EXISTS "principalEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "principalPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "status" "SchoolStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "salesOwnerId" TEXT;

ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "amountPaid" DECIMAL(10,2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'School_salesOwnerId_fkey'
  ) THEN
    ALTER TABLE "School"
      ADD CONSTRAINT "School_salesOwnerId_fkey"
      FOREIGN KEY ("salesOwnerId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ParentSubmission" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "studentId" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payloadJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParentSubmission_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ParentSubmission_schoolId_fkey'
  ) THEN
    ALTER TABLE "ParentSubmission"
      ADD CONSTRAINT "ParentSubmission_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ParentSubmission_studentId_fkey'
  ) THEN
    ALTER TABLE "ParentSubmission"
      ADD CONSTRAINT "ParentSubmission_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "Student"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ApprovalRequest" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "type" "ApprovalRequestType" NOT NULL DEFAULT 'DATA_AND_DESIGN_APPROVAL',
  "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedByUserId" TEXT NOT NULL,
  "approvedByUserId" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ApprovalRequest_schoolId_fkey'
  ) THEN
    ALTER TABLE "ApprovalRequest"
      ADD CONSTRAINT "ApprovalRequest_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ApprovalRequest_requestedByUserId_fkey'
  ) THEN
    ALTER TABLE "ApprovalRequest"
      ADD CONSTRAINT "ApprovalRequest_requestedByUserId_fkey"
      FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ApprovalRequest_approvedByUserId_fkey'
  ) THEN
    ALTER TABLE "ApprovalRequest"
      ADD CONSTRAINT "ApprovalRequest_approvedByUserId_fkey"
      FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Cost" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "costDate" TIMESTAMP(3) NOT NULL,
  "costType" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Cost_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Cost_schoolId_fkey'
  ) THEN
    ALTER TABLE "Cost"
      ADD CONSTRAINT "Cost_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
CREATE INDEX IF NOT EXISTS "User_schoolId_idx" ON "User"("schoolId");
CREATE INDEX IF NOT EXISTS "School_salesOwnerId_idx" ON "School"("salesOwnerId");
CREATE INDEX IF NOT EXISTS "School_status_idx" ON "School"("status");
CREATE INDEX IF NOT EXISTS "School_regionId_idx" ON "School"("regionId");
CREATE INDEX IF NOT EXISTS "School_city_idx" ON "School"("city");
CREATE INDEX IF NOT EXISTS "School_createdAt_idx" ON "School"("createdAt");
CREATE INDEX IF NOT EXISTS "ParentSubmission_schoolId_submittedAt_idx" ON "ParentSubmission"("schoolId", "submittedAt");
CREATE INDEX IF NOT EXISTS "ParentSubmission_submittedAt_idx" ON "ParentSubmission"("submittedAt");
CREATE INDEX IF NOT EXISTS "Student_schoolId_createdAt_idx" ON "Student"("schoolId", "createdAt");
CREATE INDEX IF NOT EXISTS "ApprovalRequest_status_requestedAt_idx" ON "ApprovalRequest"("status", "requestedAt");
CREATE INDEX IF NOT EXISTS "ApprovalRequest_schoolId_status_idx" ON "ApprovalRequest"("schoolId", "status");
CREATE INDEX IF NOT EXISTS "Invoice_issuedAt_idx" ON "Invoice"("issuedAt");
CREATE INDEX IF NOT EXISTS "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX IF NOT EXISTS "Invoice_schoolId_idx" ON "Invoice"("schoolId");
CREATE INDEX IF NOT EXISTS "Cost_costDate_idx" ON "Cost"("costDate");
CREATE INDEX IF NOT EXISTS "Cost_schoolId_idx" ON "Cost"("schoolId");
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
