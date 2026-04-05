-- CreateEnum
CREATE TYPE "IntakeActorType" AS ENUM ('PARENT', 'STUDENT', 'STAFF');

-- CreateEnum
CREATE TYPE "IntakeOtpStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "IntakeSessionStatus" AS ENUM ('OTP_PENDING', 'VERIFIED', 'DRAFT', 'SUBMITTED', 'EXPIRED', 'FAILED');

-- AlterTable
ALTER TABLE "ParentSubmission" ADD COLUMN     "actorType" "IntakeActorType",
ADD COLUMN     "authSessionId" TEXT,
ADD COLUMN     "otpVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "sessionStatus" "IntakeSessionStatus",
ADD COLUMN     "verifiedMobile" TEXT;

-- CreateTable
CREATE TABLE "IntakeAuthSession" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT,
    "intakeLinkId" TEXT NOT NULL,
    "mobileNumber" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "otpStatus" "IntakeOtpStatus" NOT NULL DEFAULT 'PENDING',
    "actorType" "IntakeActorType" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "verifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sessionStatus" "IntakeSessionStatus" NOT NULL DEFAULT 'OTP_PENDING',
    "sessionTokenHash" TEXT,
    "allowMobileEdit" BOOLEAN NOT NULL DEFAULT false,
    "duplicatePolicy" TEXT,
    "draftPayloadJson" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntakeAuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntakeAuthSession_sessionTokenHash_key" ON "IntakeAuthSession"("sessionTokenHash");

-- CreateIndex
CREATE INDEX "IntakeAuthSession_campaignId_createdAt_idx" ON "IntakeAuthSession"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "IntakeAuthSession_intakeLinkId_createdAt_idx" ON "IntakeAuthSession"("intakeLinkId", "createdAt");

-- CreateIndex
CREATE INDEX "IntakeAuthSession_mobileNumber_createdAt_idx" ON "IntakeAuthSession"("mobileNumber", "createdAt");

-- CreateIndex
CREATE INDEX "IntakeAuthSession_otpStatus_expiresAt_idx" ON "IntakeAuthSession"("otpStatus", "expiresAt");

-- CreateIndex
CREATE INDEX "IntakeAuthSession_sessionStatus_expiresAt_idx" ON "IntakeAuthSession"("sessionStatus", "expiresAt");

-- CreateIndex
CREATE INDEX "ParentSubmission_authSessionId_idx" ON "ParentSubmission"("authSessionId");

-- CreateIndex
CREATE INDEX "ParentSubmission_verifiedMobile_submittedAt_idx" ON "ParentSubmission"("verifiedMobile", "submittedAt");

-- AddForeignKey
ALTER TABLE "ParentSubmission" ADD CONSTRAINT "ParentSubmission_authSessionId_fkey" FOREIGN KEY ("authSessionId") REFERENCES "IntakeAuthSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeAuthSession" ADD CONSTRAINT "IntakeAuthSession_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "IntakeCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeAuthSession" ADD CONSTRAINT "IntakeAuthSession_intakeLinkId_fkey" FOREIGN KEY ("intakeLinkId") REFERENCES "IntakeLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
