ALTER TABLE "ParentSubmission"
ADD COLUMN "payloadCiphertext" TEXT;

CREATE TABLE "OtpChallenge" (
  "id" TEXT NOT NULL,
  "mobile" TEXT NOT NULL,
  "otpHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "consumedAt" TIMESTAMP(3),
  "requestedIp" TEXT,
  "requestedAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OtpChallenge_mobile_createdAt_idx" ON "OtpChallenge"("mobile", "createdAt");
CREATE INDEX "OtpChallenge_mobile_expiresAt_idx" ON "OtpChallenge"("mobile", "expiresAt");
CREATE INDEX "OtpChallenge_expiresAt_idx" ON "OtpChallenge"("expiresAt");
CREATE INDEX "OtpChallenge_consumedAt_idx" ON "OtpChallenge"("consumedAt");
