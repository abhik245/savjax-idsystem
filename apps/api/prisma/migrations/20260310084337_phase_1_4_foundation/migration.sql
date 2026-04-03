-- CreateEnum
CREATE TYPE "InstitutionType" AS ENUM ('SCHOOL', 'COLLEGE', 'COMPANY');

-- CreateEnum
CREATE TYPE "IntakeAudience" AS ENUM ('PARENT', 'STUDENT', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "IntakeSubmissionStage" AS ENUM ('DRAFT', 'SUBMITTED', 'VALIDATION_FAILED', 'UNDER_REVIEW', 'SALES_CORRECTED', 'AWAITING_INSTITUTION_APPROVAL', 'APPROVED_FOR_DESIGN', 'DESIGN_READY', 'APPROVED_FOR_PRINT', 'IN_PRINT_QUEUE', 'PRINTED', 'DISPATCHED', 'ISSUED', 'REISSUE_REQUESTED', 'REISSUED', 'REJECTED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "PhotoQualityStatus" AS ENUM ('NOT_CHECKED', 'PASSED', 'WARN', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('RAZORPAY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED');

-- AlterTable
ALTER TABLE "IntakeLink" ADD COLUMN     "allowDraftSave" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowPhotoUpload" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowSiblings" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "approvalOwnerId" TEXT,
ADD COLUMN     "audience" "IntakeAudience" NOT NULL DEFAULT 'PARENT',
ADD COLUMN     "campaignName" TEXT NOT NULL DEFAULT 'Default Intake Campaign',
ADD COLUMN     "formSchema" JSONB,
ADD COLUMN     "institutionType" "InstitutionType" NOT NULL DEFAULT 'SCHOOL',
ADD COLUMN     "metadataJson" JSONB,
ADD COLUMN     "paymentRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "photoCaptureRequired" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "templateId" TEXT;

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "institutionType" "InstitutionType" NOT NULL DEFAULT 'SCHOOL';

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "correctedAt" TIMESTAMP(3),
ADD COLUMN     "intakeStage" "IntakeSubmissionStage" NOT NULL DEFAULT 'SUBMITTED',
ADD COLUMN     "photoAnalysisJson" JSONB,
ADD COLUMN     "photoQualityScore" DOUBLE PRECISION,
ADD COLUMN     "photoQualityStatus" "PhotoQualityStatus" NOT NULL DEFAULT 'NOT_CHECKED';

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "engineVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "lastSnapshotVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "CorrectionLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "reason" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorrectionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateSnapshot" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "mappingJson" JSONB NOT NULL,
    "frontDesignUrl" TEXT,
    "backDesignUrl" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentLedger" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'RAZORPAY',
    "providerOrderId" TEXT,
    "providerPaymentId" TEXT,
    "providerSignature" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "metaJson" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CorrectionLog_schoolId_idx" ON "CorrectionLog"("schoolId");

-- CreateIndex
CREATE INDEX "CorrectionLog_studentId_idx" ON "CorrectionLog"("studentId");

-- CreateIndex
CREATE INDEX "CorrectionLog_actorUserId_idx" ON "CorrectionLog"("actorUserId");

-- CreateIndex
CREATE INDEX "CorrectionLog_createdAt_idx" ON "CorrectionLog"("createdAt");

-- CreateIndex
CREATE INDEX "TemplateSnapshot_createdById_idx" ON "TemplateSnapshot"("createdById");

-- CreateIndex
CREATE INDEX "TemplateSnapshot_createdAt_idx" ON "TemplateSnapshot"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateSnapshot_templateId_version_key" ON "TemplateSnapshot"("templateId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentLedger_providerOrderId_key" ON "PaymentLedger"("providerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentLedger_providerPaymentId_key" ON "PaymentLedger"("providerPaymentId");

-- CreateIndex
CREATE INDEX "PaymentLedger_schoolId_idx" ON "PaymentLedger"("schoolId");

-- CreateIndex
CREATE INDEX "PaymentLedger_invoiceId_idx" ON "PaymentLedger"("invoiceId");

-- CreateIndex
CREATE INDEX "PaymentLedger_status_idx" ON "PaymentLedger"("status");

-- CreateIndex
CREATE INDEX "PaymentLedger_providerOrderId_idx" ON "PaymentLedger"("providerOrderId");

-- CreateIndex
CREATE INDEX "PaymentLedger_providerPaymentId_idx" ON "PaymentLedger"("providerPaymentId");

-- CreateIndex
CREATE INDEX "IntakeLink_schoolId_institutionType_idx" ON "IntakeLink"("schoolId", "institutionType");

-- CreateIndex
CREATE INDEX "IntakeLink_approvalOwnerId_idx" ON "IntakeLink"("approvalOwnerId");

-- CreateIndex
CREATE INDEX "IntakeLink_templateId_idx" ON "IntakeLink"("templateId");

-- AddForeignKey
ALTER TABLE "IntakeLink" ADD CONSTRAINT "IntakeLink_approvalOwnerId_fkey" FOREIGN KEY ("approvalOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeLink" ADD CONSTRAINT "IntakeLink_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionLog" ADD CONSTRAINT "CorrectionLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionLog" ADD CONSTRAINT "CorrectionLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionLog" ADD CONSTRAINT "CorrectionLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateSnapshot" ADD CONSTRAINT "TemplateSnapshot_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateSnapshot" ADD CONSTRAINT "TemplateSnapshot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentLedger" ADD CONSTRAINT "PaymentLedger_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentLedger" ADD CONSTRAINT "PaymentLedger_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentLedger" ADD CONSTRAINT "PaymentLedger_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
