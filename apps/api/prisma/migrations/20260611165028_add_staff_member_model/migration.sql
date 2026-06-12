-- AlterEnum
ALTER TYPE "IntakeAudience" ADD VALUE 'STAFF';

-- CreateTable
CREATE TABLE "StaffMember" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "intakeLinkId" TEXT,
    "fullName" TEXT NOT NULL,
    "mobile" TEXT,
    "mobileCiphertext" TEXT,
    "employeeId" TEXT,
    "designation" TEXT,
    "department" TEXT,
    "education" TEXT,
    "joiningDate" TEXT,
    "dob" TEXT,
    "bloodGroup" TEXT,
    "address" TEXT,
    "addressCiphertext" TEXT,
    "emergencyNumber" TEXT,
    "aadhaarNumber" TEXT,
    "photoKey" TEXT NOT NULL,
    "status" "StudentStatus" NOT NULL DEFAULT 'SUBMITTED',
    "intakeStage" "IntakeSubmissionStage" NOT NULL DEFAULT 'SUBMITTED',
    "photoQualityStatus" "PhotoQualityStatus" NOT NULL DEFAULT 'NOT_CHECKED',
    "photoQualityScore" DOUBLE PRECISION,
    "photoAnalysisJson" JSONB,
    "duplicateKey" TEXT,
    "duplicateFlag" BOOLEAN NOT NULL DEFAULT false,
    "rejectionNote" TEXT,
    "correctedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffMember_schoolId_createdAt_idx" ON "StaffMember"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffMember_intakeLinkId_idx" ON "StaffMember"("intakeLinkId");

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_intakeLinkId_fkey" FOREIGN KEY ("intakeLinkId") REFERENCES "IntakeLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
