DROP INDEX IF EXISTS "Parent_mobile_key";

ALTER TABLE "Parent"
ADD COLUMN     "mobileHash" TEXT,
ADD COLUMN     "mobileCiphertext" TEXT;

CREATE UNIQUE INDEX "Parent_mobileHash_key" ON "Parent"("mobileHash");
