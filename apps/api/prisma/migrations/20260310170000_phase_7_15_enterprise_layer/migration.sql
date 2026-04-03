-- CreateEnum
CREATE TYPE "AsyncJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AsyncJobType" AS ENUM ('PHOTO_ANALYZE', 'TEMPLATE_REBIND', 'REPORT_EXPORT', 'DIGITAL_ID_BULK');

-- CreateTable
CREATE TABLE "FieldMaskPolicy" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "rolesAllowed" TEXT[],
    "maskStrategy" TEXT NOT NULL DEFAULT 'PARTIAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldMaskPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowAutomationRule" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerStage" "IntakeSubmissionStage" NOT NULL,
    "conditionJson" JSONB,
    "actionType" TEXT NOT NULL,
    "actionConfigJson" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowAutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsyncJob" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "type" "AsyncJobType" NOT NULL,
    "status" "AsyncJobStatus" NOT NULL DEFAULT 'QUEUED',
    "payloadJson" JSONB,
    "resultJson" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AsyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QrScanEvent" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "scannerUserId" TEXT,
    "scannerRole" TEXT NOT NULL,
    "location" TEXT,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrScanEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FieldMaskPolicy_schoolId_fieldKey_key" ON "FieldMaskPolicy"("schoolId", "fieldKey");

-- CreateIndex
CREATE INDEX "FieldMaskPolicy_schoolId_isActive_idx" ON "FieldMaskPolicy"("schoolId", "isActive");

-- CreateIndex
CREATE INDEX "WorkflowAutomationRule_schoolId_isActive_priority_idx" ON "WorkflowAutomationRule"("schoolId", "isActive", "priority");

-- CreateIndex
CREATE INDEX "WorkflowAutomationRule_triggerStage_idx" ON "WorkflowAutomationRule"("triggerStage");

-- CreateIndex
CREATE INDEX "AsyncJob_status_runAfter_idx" ON "AsyncJob"("status", "runAfter");

-- CreateIndex
CREATE INDEX "AsyncJob_type_status_idx" ON "AsyncJob"("type", "status");

-- CreateIndex
CREATE INDEX "AsyncJob_schoolId_idx" ON "AsyncJob"("schoolId");

-- CreateIndex
CREATE INDEX "QrScanEvent_schoolId_createdAt_idx" ON "QrScanEvent"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "QrScanEvent_studentId_createdAt_idx" ON "QrScanEvent"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "QrScanEvent_scannerUserId_idx" ON "QrScanEvent"("scannerUserId");

-- AddForeignKey
ALTER TABLE "FieldMaskPolicy" ADD CONSTRAINT "FieldMaskPolicy_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowAutomationRule" ADD CONSTRAINT "WorkflowAutomationRule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowAutomationRule" ADD CONSTRAINT "WorkflowAutomationRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsyncJob" ADD CONSTRAINT "AsyncJob_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsyncJob" ADD CONSTRAINT "AsyncJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrScanEvent" ADD CONSTRAINT "QrScanEvent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrScanEvent" ADD CONSTRAINT "QrScanEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrScanEvent" ADD CONSTRAINT "QrScanEvent_scannerUserId_fkey" FOREIGN KEY ("scannerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
