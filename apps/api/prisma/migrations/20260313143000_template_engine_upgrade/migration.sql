-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TemplateLifecycleStatus') THEN
    CREATE TYPE "TemplateLifecycleStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TemplateCardType') THEN
    CREATE TYPE "TemplateCardType" AS ENUM ('STUDENT', 'STAFF', 'VISITOR', 'CONTRACTOR', 'EMPLOYEE', 'CUSTOM');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CardOrientation') THEN
    CREATE TYPE "CardOrientation" AS ENUM ('PORTRAIT', 'LANDSCAPE');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TemplateAssignmentScope') THEN
    CREATE TYPE "TemplateAssignmentScope" AS ENUM ('ORG_DEFAULT', 'SCHOOL_DEFAULT', 'CAMPAIGN', 'CLASS_SECTION', 'CARD_TYPE');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RenderBatchStatus') THEN
    CREATE TYPE "RenderBatchStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'PARTIAL_FAILED', 'FAILED');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RenderBatchItemStatus') THEN
    CREATE TYPE "RenderBatchItemStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'SKIPPED');
  END IF;
END $$;

-- AlterTable
ALTER TABLE "Template"
  ADD COLUMN "templateCode" TEXT,
  ADD COLUMN "institutionType" "InstitutionType" NOT NULL DEFAULT 'SCHOOL',
  ADD COLUMN "cardType" "TemplateCardType" NOT NULL DEFAULT 'STUDENT',
  ADD COLUMN "orientation" "CardOrientation" NOT NULL DEFAULT 'PORTRAIT',
  ADD COLUMN "cardWidthMm" DECIMAL(6,2),
  ADD COLUMN "cardHeightMm" DECIMAL(6,2),
  ADD COLUMN "frontLayoutJson" JSONB,
  ADD COLUMN "backLayoutJson" JSONB,
  ADD COLUMN "status" "TemplateLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "updatedById" TEXT,
  ADD COLUMN "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TemplateSnapshot"
  ADD COLUMN "status" "TemplateLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "frontLayoutJson" JSONB,
  ADD COLUMN "backLayoutJson" JSONB,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "schemaVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "TemplateAssignment" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "institutionType" "InstitutionType" NOT NULL DEFAULT 'SCHOOL',
  "scope" "TemplateAssignmentScope" NOT NULL,
  "intakeLinkId" TEXT,
  "className" TEXT,
  "section" TEXT,
  "cardType" "TemplateCardType" NOT NULL DEFAULT 'STUDENT',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "notes" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "TemplateAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RenderBatch" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "initiatedById" TEXT NOT NULL,
  "status" "RenderBatchStatus" NOT NULL DEFAULT 'QUEUED',
  "mode" TEXT NOT NULL DEFAULT 'SELECTED',
  "filtersJson" JSONB,
  "optionsJson" JSONB,
  "totalRecords" INTEGER NOT NULL DEFAULT 0,
  "successCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "artifactUrl" TEXT,
  "artifactMetaJson" JSONB,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RenderBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RenderBatchItem" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "status" "RenderBatchItemStatus" NOT NULL DEFAULT 'PENDING',
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "warningJson" JSONB,
  "previewJson" JSONB,
  "outputUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RenderBatchItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Template_templateCode_key" ON "Template"("templateCode");

-- CreateIndex
CREATE INDEX "Template_schoolId_status_idx" ON "Template"("schoolId", "status");

-- CreateIndex
CREATE INDEX "Template_schoolId_institutionType_cardType_idx" ON "Template"("schoolId", "institutionType", "cardType");

-- CreateIndex
CREATE INDEX "Template_isActive_isDefault_idx" ON "Template"("isActive", "isDefault");

-- CreateIndex
CREATE INDEX "Template_createdById_idx" ON "Template"("createdById");

-- CreateIndex
CREATE INDEX "Template_updatedById_idx" ON "Template"("updatedById");

-- CreateIndex
CREATE INDEX "TemplateAssignment_schoolId_scope_isActive_idx" ON "TemplateAssignment"("schoolId", "scope", "isActive");

-- CreateIndex
CREATE INDEX "TemplateAssignment_templateId_isActive_idx" ON "TemplateAssignment"("templateId", "isActive");

-- CreateIndex
CREATE INDEX "TemplateAssignment_intakeLinkId_idx" ON "TemplateAssignment"("intakeLinkId");

-- CreateIndex
CREATE INDEX "TemplateAssignment_createdById_idx" ON "TemplateAssignment"("createdById");

-- CreateIndex
CREATE INDEX "TemplateAssignment_updatedById_idx" ON "TemplateAssignment"("updatedById");

-- CreateIndex
CREATE INDEX "RenderBatch_schoolId_createdAt_idx" ON "RenderBatch"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "RenderBatch_templateId_createdAt_idx" ON "RenderBatch"("templateId", "createdAt");

-- CreateIndex
CREATE INDEX "RenderBatch_initiatedById_createdAt_idx" ON "RenderBatch"("initiatedById", "createdAt");

-- CreateIndex
CREATE INDEX "RenderBatch_status_createdAt_idx" ON "RenderBatch"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RenderBatchItem_batchId_studentId_key" ON "RenderBatchItem"("batchId", "studentId");

-- CreateIndex
CREATE INDEX "RenderBatchItem_batchId_status_idx" ON "RenderBatchItem"("batchId", "status");

-- CreateIndex
CREATE INDEX "RenderBatchItem_studentId_status_idx" ON "RenderBatchItem"("studentId", "status");

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateAssignment" ADD CONSTRAINT "TemplateAssignment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateAssignment" ADD CONSTRAINT "TemplateAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateAssignment" ADD CONSTRAINT "TemplateAssignment_intakeLinkId_fkey" FOREIGN KEY ("intakeLinkId") REFERENCES "IntakeLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateAssignment" ADD CONSTRAINT "TemplateAssignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateAssignment" ADD CONSTRAINT "TemplateAssignment_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenderBatch" ADD CONSTRAINT "RenderBatch_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenderBatch" ADD CONSTRAINT "RenderBatch_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenderBatch" ADD CONSTRAINT "RenderBatch_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenderBatchItem" ADD CONSTRAINT "RenderBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "RenderBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenderBatchItem" ADD CONSTRAINT "RenderBatchItem_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
