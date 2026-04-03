-- AlterTable
ALTER TABLE "PrintJob"
ADD COLUMN "sourcePrintJobId" TEXT,
ADD COLUMN "batchCode" TEXT,
ADD COLUMN "isReprint" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "artifactMetaJson" JSONB,
ADD COLUMN "dispatchedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "PrintJob_sourcePrintJobId_idx" ON "PrintJob"("sourcePrintJobId");

-- CreateIndex
CREATE INDEX "PrintJob_isReprint_idx" ON "PrintJob"("isReprint");

-- CreateIndex
CREATE UNIQUE INDEX "PrintJob_batchCode_key" ON "PrintJob"("batchCode");

-- AddForeignKey
ALTER TABLE "PrintJob"
ADD CONSTRAINT "PrintJob_sourcePrintJobId_fkey"
FOREIGN KEY ("sourcePrintJobId") REFERENCES "PrintJob"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
