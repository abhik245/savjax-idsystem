-- CreateEnum
CREATE TYPE "ApprovalWorkflowStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'SENT_BACK', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "ApprovalActionType" AS ENUM ('APPROVE', 'REJECT', 'SEND_BACK', 'COMMENT');

-- AlterTable
ALTER TABLE "ApprovalRequest" ADD COLUMN "approvalWorkflowId" TEXT;

-- CreateTable
CREATE TABLE "ApprovalChain" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "institutionType" "InstitutionType" NOT NULL DEFAULT 'SCHOOL',
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ApprovalChain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalChainStep" (
    "id" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "role" "Role" NOT NULL,
    "label" TEXT,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "slaHours" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalChainStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalWorkflow" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "currentStepId" TEXT,
    "status" "ApprovalWorkflowStatus" NOT NULL DEFAULT 'PENDING',
    "startedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "latestComment" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalWorkflowAction" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "stepId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "action" "ApprovalActionType" NOT NULL,
    "comment" TEXT,
    "fromStatus" "ApprovalWorkflowStatus",
    "toStatus" "ApprovalWorkflowStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalWorkflowAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApprovalRequest_approvalWorkflowId_idx" ON "ApprovalRequest"("approvalWorkflowId");

-- CreateIndex
CREATE INDEX "ApprovalChain_schoolId_institutionType_idx" ON "ApprovalChain"("schoolId", "institutionType");

-- CreateIndex
CREATE INDEX "ApprovalChain_schoolId_institutionType_isActive_idx" ON "ApprovalChain"("schoolId", "institutionType", "isActive");

-- CreateIndex
CREATE INDEX "ApprovalChain_createdById_idx" ON "ApprovalChain"("createdById");

-- CreateIndex
CREATE INDEX "ApprovalChainStep_chainId_idx" ON "ApprovalChainStep"("chainId");

-- CreateIndex
CREATE INDEX "ApprovalChainStep_role_idx" ON "ApprovalChainStep"("role");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalChainStep_chainId_stepOrder_key" ON "ApprovalChainStep"("chainId", "stepOrder");

-- CreateIndex
CREATE INDEX "ApprovalWorkflow_schoolId_status_startedAt_idx" ON "ApprovalWorkflow"("schoolId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "ApprovalWorkflow_studentId_status_idx" ON "ApprovalWorkflow"("studentId", "status");

-- CreateIndex
CREATE INDEX "ApprovalWorkflow_chainId_status_idx" ON "ApprovalWorkflow"("chainId", "status");

-- CreateIndex
CREATE INDEX "ApprovalWorkflow_currentStepId_idx" ON "ApprovalWorkflow"("currentStepId");

-- CreateIndex
CREATE INDEX "ApprovalWorkflow_startedById_idx" ON "ApprovalWorkflow"("startedById");

-- CreateIndex
CREATE INDEX "ApprovalWorkflow_decidedById_idx" ON "ApprovalWorkflow"("decidedById");

-- CreateIndex
CREATE INDEX "ApprovalWorkflowAction_workflowId_createdAt_idx" ON "ApprovalWorkflowAction"("workflowId", "createdAt");

-- CreateIndex
CREATE INDEX "ApprovalWorkflowAction_actorUserId_idx" ON "ApprovalWorkflowAction"("actorUserId");

-- CreateIndex
CREATE INDEX "ApprovalWorkflowAction_stepId_idx" ON "ApprovalWorkflowAction"("stepId");

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_approvalWorkflowId_fkey" FOREIGN KEY ("approvalWorkflowId") REFERENCES "ApprovalWorkflow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalChain" ADD CONSTRAINT "ApprovalChain_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalChain" ADD CONSTRAINT "ApprovalChain_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalChainStep" ADD CONSTRAINT "ApprovalChainStep_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "ApprovalChain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalWorkflow" ADD CONSTRAINT "ApprovalWorkflow_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalWorkflow" ADD CONSTRAINT "ApprovalWorkflow_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalWorkflow" ADD CONSTRAINT "ApprovalWorkflow_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "ApprovalChain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalWorkflow" ADD CONSTRAINT "ApprovalWorkflow_currentStepId_fkey" FOREIGN KEY ("currentStepId") REFERENCES "ApprovalChainStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalWorkflow" ADD CONSTRAINT "ApprovalWorkflow_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalWorkflow" ADD CONSTRAINT "ApprovalWorkflow_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalWorkflowAction" ADD CONSTRAINT "ApprovalWorkflowAction_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "ApprovalWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalWorkflowAction" ADD CONSTRAINT "ApprovalWorkflowAction_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "ApprovalChainStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalWorkflowAction" ADD CONSTRAINT "ApprovalWorkflowAction_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
