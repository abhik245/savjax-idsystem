-- AlterTable
ALTER TABLE "IntakeCampaign" ADD COLUMN     "customFieldsJson" JSONB;

-- AlterTable
ALTER TABLE "StaffMember" ADD COLUMN     "customFieldsJson" JSONB;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "customFieldsJson" JSONB;
