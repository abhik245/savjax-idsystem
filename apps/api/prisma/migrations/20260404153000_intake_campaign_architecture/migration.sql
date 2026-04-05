CREATE TABLE "IntakeCampaign" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institutionType" "InstitutionType" NOT NULL DEFAULT 'SCHOOL',
    "audience" "IntakeAudience" NOT NULL DEFAULT 'PARENT',
    "maxExpectedVolume" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "targetSegmentsJson" JSONB NOT NULL,
    "dataSchemaJson" JSONB,
    "submissionModelJson" JSONB,
    "approvalRulesJson" JSONB,
    "metadataJson" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "IntakeCampaign_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "IntakeLink"
ADD COLUMN IF NOT EXISTS "campaignId" TEXT;

CREATE INDEX "IntakeCampaign_schoolId_createdAt_idx" ON "IntakeCampaign"("schoolId", "createdAt");
CREATE INDEX "IntakeCampaign_schoolId_institutionType_idx" ON "IntakeCampaign"("schoolId", "institutionType");
CREATE INDEX "IntakeCampaign_schoolId_isActive_idx" ON "IntakeCampaign"("schoolId", "isActive");
CREATE INDEX "IntakeCampaign_expiresAt_idx" ON "IntakeCampaign"("expiresAt");
CREATE INDEX "IntakeLink_campaignId_idx" ON "IntakeLink"("campaignId");

ALTER TABLE "IntakeCampaign"
ADD CONSTRAINT "IntakeCampaign_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IntakeLink"
ADD CONSTRAINT "IntakeLink_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "IntakeCampaign"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
