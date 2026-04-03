import {
  ApprovalActionType,
  ApprovalRequestStatus,
  ApprovalRequestType,
  ApprovalWorkflowStatus,
  InstitutionType,
  IntakeAudience,
  IntakeSubmissionStage,
  PrismaClient,
  Role,
  SchoolStatus,
  StudentStatus
} from "@prisma/client";
import * as bcrypt from "bcrypt";
import { ConfigService } from "@nestjs/config";
import { DataProtectionService } from "../src/common/services/data-protection.service";

const prisma = new PrismaClient();
const dataProtectionService = new DataProtectionService(
  new ConfigService({
    NODE_ENV: process.env.NODE_ENV || "development",
    FIELD_ENCRYPTION_KEY: process.env.FIELD_ENCRYPTION_KEY
  })
);

function buildParentMobileData(mobile: string) {
  return {
    mobile: dataProtectionService.maskPhone(mobile) || mobile,
    mobileHash: dataProtectionService.stableHash(mobile),
    mobileCiphertext: dataProtectionService.encryptText(mobile)
  };
}

async function main() {
  const passwordHash = await bcrypt.hash("Admin@123", 10);

  const west = await prisma.region.upsert({
    where: { code: "WEST" },
    update: {},
    create: { code: "WEST", name: "West Region" }
  });
  const north = await prisma.region.upsert({
    where: { code: "NORTH" },
    update: {},
    create: { code: "NORTH", name: "North Region" }
  });

  const mainAdmin = await prisma.user.upsert({
    where: { email: "main.admin@demo.com" },
    update: {
      role: Role.SUPER_ADMIN,
      passwordHash,
      isActive: true,
      deletedAt: null,
      failedLoginCount: 0,
      lockoutUntil: null
    },
    create: {
      email: "main.admin@demo.com",
      name: "Main Admin",
      role: Role.SUPER_ADMIN,
      passwordHash
    }
  });

  const companyAdmin = await prisma.user.upsert({
    where: { email: "company.admin@demo.com" },
    update: {
      role: Role.COMPANY_ADMIN,
      passwordHash,
      isActive: true,
      name: "Company Admin",
      deletedAt: null,
      failedLoginCount: 0,
      lockoutUntil: null
    },
    create: {
      email: "company.admin@demo.com",
      name: "Company Admin",
      role: Role.COMPANY_ADMIN,
      passwordHash
    }
  });

  const salesWest = await prisma.user.upsert({
    where: { email: "sales@demo.com" },
    update: {
      role: Role.SALES_PERSON,
      passwordHash,
      isActive: true,
      name: "Rahul Sales",
      deletedAt: null,
      failedLoginCount: 0,
      lockoutUntil: null
    },
    create: { email: "sales@demo.com", name: "Rahul Sales", role: Role.SALES_PERSON, passwordHash }
  });

  const salesNorth = await prisma.user.upsert({
    where: { email: "sales.north@demo.com" },
    update: {
      role: Role.SALES_PERSON,
      passwordHash,
      isActive: true,
      name: "Neha Sales",
      deletedAt: null,
      failedLoginCount: 0,
      lockoutUntil: null
    },
    create: { email: "sales.north@demo.com", name: "Neha Sales", role: Role.SALES_PERSON, passwordHash }
  });

  const printer = await prisma.user.upsert({
    where: { email: "printer@demo.com" },
    update: {
      role: Role.PRINTING,
      passwordHash,
      isActive: true,
      name: "Print Operator",
      deletedAt: null,
      failedLoginCount: 0,
      lockoutUntil: null
    },
    create: { email: "printer@demo.com", name: "Print Operator", role: Role.PRINTING, passwordHash }
  });

  const school1 = await prisma.school.upsert({
    where: { code: "DEMO001" },
    update: {
      name: "Demo International School",
      email: "school.admin@demo.com",
      regionId: west.id,
      city: "Pune",
      state: "Maharashtra",
      salesOwnerId: salesWest.id,
      institutionType: InstitutionType.SCHOOL,
      status: SchoolStatus.ACTIVE
    },
    create: {
      code: "DEMO001",
      name: "Demo International School",
      email: "school.admin@demo.com",
      regionId: west.id,
      city: "Pune",
      state: "Maharashtra",
      salesOwnerId: salesWest.id,
      institutionType: InstitutionType.SCHOOL,
      status: SchoolStatus.ACTIVE
    }
  });

  const school2 = await prisma.school.upsert({
    where: { code: "OAK002" },
    update: {
      name: "Oakridge Public School",
      email: "oak.admin@demo.com",
      regionId: west.id,
      city: "Mumbai",
      state: "Maharashtra",
      salesOwnerId: salesWest.id,
      institutionType: InstitutionType.COLLEGE,
      status: SchoolStatus.ACTIVE
    },
    create: {
      code: "OAK002",
      name: "Oakridge Public School",
      email: "oak.admin@demo.com",
      regionId: west.id,
      city: "Mumbai",
      state: "Maharashtra",
      salesOwnerId: salesWest.id,
      institutionType: InstitutionType.COLLEGE,
      status: SchoolStatus.ACTIVE
    }
  });

  const school3 = await prisma.school.upsert({
    where: { code: "RIV003" },
    update: {
      name: "Riverdale Academy",
      email: "river.admin@demo.com",
      regionId: north.id,
      city: "Delhi",
      state: "Delhi",
      salesOwnerId: salesNorth.id,
      institutionType: InstitutionType.COMPANY,
      status: SchoolStatus.ACTIVE
    },
    create: {
      code: "RIV003",
      name: "Riverdale Academy",
      email: "river.admin@demo.com",
      regionId: north.id,
      city: "Delhi",
      state: "Delhi",
      salesOwnerId: salesNorth.id,
      institutionType: InstitutionType.COMPANY,
      status: SchoolStatus.ACTIVE
    }
  });

  const schoolAdmin1 = await prisma.user.upsert({
    where: { email: "school.admin@demo.com" },
    update: {
      role: Role.SCHOOL_ADMIN,
      schoolId: school1.id,
      passwordHash,
      isActive: true,
      deletedAt: null,
      failedLoginCount: 0,
      lockoutUntil: null
    },
    create: {
      email: "school.admin@demo.com",
      role: Role.SCHOOL_ADMIN,
      schoolId: school1.id,
      name: "School Admin Demo",
      passwordHash
    }
  });

  const schoolAdmin2 = await prisma.user.upsert({
    where: { email: "oak.admin@demo.com" },
    update: {
      role: Role.SCHOOL_ADMIN,
      schoolId: school2.id,
      passwordHash,
      isActive: true,
      deletedAt: null,
      failedLoginCount: 0,
      lockoutUntil: null
    },
    create: {
      email: "oak.admin@demo.com",
      role: Role.SCHOOL_ADMIN,
      schoolId: school2.id,
      name: "School Admin Oak",
      passwordHash
    }
  });

  const schoolAdmin3 = await prisma.user.upsert({
    where: { email: "river.admin@demo.com" },
    update: {
      role: Role.SCHOOL_ADMIN,
      schoolId: school3.id,
      passwordHash,
      isActive: true,
      deletedAt: null,
      failedLoginCount: 0,
      lockoutUntil: null
    },
    create: {
      email: "river.admin@demo.com",
      role: Role.SCHOOL_ADMIN,
      schoolId: school3.id,
      name: "School Admin River",
      passwordHash
    }
  });

  await prisma.user.upsert({
    where: { email: "school.staff@demo.com" },
    update: {
      role: Role.SCHOOL_STAFF,
      schoolId: school1.id,
      passwordHash,
      isActive: true,
      deletedAt: null,
      failedLoginCount: 0,
      lockoutUntil: null
    },
    create: {
      email: "school.staff@demo.com",
      role: Role.SCHOOL_STAFF,
      schoolId: school1.id,
      name: "School Staff Demo",
      passwordHash
    }
  });

  await prisma.salesAssignment.upsert({
    where: {
      salesPersonId_schoolId: {
        salesPersonId: salesWest.id,
        schoolId: school1.id
      }
    },
    update: { deletedAt: null, createdById: mainAdmin.id },
    create: {
      salesPersonId: salesWest.id,
      schoolId: school1.id,
      createdById: mainAdmin.id
    }
  });
  await prisma.salesAssignment.upsert({
    where: {
      salesPersonId_schoolId: {
        salesPersonId: salesWest.id,
        schoolId: school2.id
      }
    },
    update: { deletedAt: null, createdById: mainAdmin.id },
    create: {
      salesPersonId: salesWest.id,
      schoolId: school2.id,
      createdById: mainAdmin.id
    }
  });
  await prisma.salesAssignment.upsert({
    where: {
      salesPersonId_schoolId: {
        salesPersonId: salesNorth.id,
        schoolId: school3.id
      }
    },
    update: { deletedAt: null, createdById: mainAdmin.id },
    create: {
      salesPersonId: salesNorth.id,
      schoolId: school3.id,
      createdById: mainAdmin.id
    }
  });

  // Reset demo analytics tables
  await prisma.approvalWorkflowAction.deleteMany();
  await prisma.approvalWorkflow.deleteMany();
  await prisma.approvalChainStep.deleteMany();
  await prisma.approvalChain.deleteMany();
  await prisma.intakeLink.deleteMany();
  await prisma.parentSubmission.deleteMany();
  await prisma.approvalRequest.deleteMany();
  await prisma.cost.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.student.deleteMany();
  await prisma.parent.deleteMany();

  const schools = [
    { school: school1, admin: schoolAdmin1, mobile: "9000000001" },
    { school: school2, admin: schoolAdmin2, mobile: "9000000002" },
    { school: school3, admin: schoolAdmin3, mobile: "9000000003" }
  ];
  const chainBySchool = new Map<
    string,
    {
      id: string;
      institutionType: InstitutionType;
      steps: Array<{ id: string; stepOrder: number; role: Role }>;
    }
  >();

  for (const item of schools) {
    const baseStepsByInstitution: Record<InstitutionType, Role[]> = {
      [InstitutionType.SCHOOL]: [Role.SCHOOL_ADMIN, Role.SALES_PERSON, Role.PRINTING],
      [InstitutionType.COLLEGE]: [Role.SCHOOL_ADMIN, Role.SALES_PERSON],
      [InstitutionType.COMPANY]: [Role.COMPANY_ADMIN, Role.PRINTING]
    };

    const steps = baseStepsByInstitution[item.school.institutionType];
    const chain = await prisma.approvalChain.create({
      data: {
        schoolId: item.school.id,
        institutionType: item.school.institutionType,
        name: `${item.school.code} Default ${item.school.institutionType} Chain`,
        isActive: true,
        version: 1,
        createdById: mainAdmin.id,
        steps: {
          create: steps.map((role, index) => ({
            stepOrder: index + 1,
            role,
            label: `Step ${index + 1} - ${role}`,
            isOptional: false
          }))
        }
      },
      include: {
        steps: {
          orderBy: { stepOrder: "asc" },
          select: { id: true, stepOrder: true, role: true }
        }
      }
    });

    chainBySchool.set(item.school.id, {
      id: chain.id,
      institutionType: chain.institutionType,
      steps: chain.steps
    });
  }

  const now = new Date();
  for (let sIndex = 0; sIndex < schools.length; sIndex++) {
    const item = schools[sIndex];
    const parentUser = await prisma.user.upsert({
      where: { email: `${item.school.code.toLowerCase()}-parent@parent.local` },
      update: { role: Role.PARENT, isActive: true },
      create: {
        email: `${item.school.code.toLowerCase()}-parent@parent.local`,
        role: Role.PARENT,
        isActive: true
      }
    });
    const parent = await prisma.parent.upsert({
      where: { userId: parentUser.id },
      update: buildParentMobileData(item.mobile),
      create: { userId: parentUser.id, ...buildParentMobileData(item.mobile) }
    });

    for (let i = 1; i <= 36; i++) {
      const createdAt = new Date(now);
      createdAt.setDate(now.getDate() - (i * (sIndex + 1)) % 88);
      const student = await prisma.student.create({
        data: {
          schoolId: item.school.id,
          parentId: parent.id,
          fullName: `Student ${sIndex + 1}-${i}`,
          parentName: `Parent ${sIndex + 1}`,
          parentMobile: item.mobile,
          className: `0${((i % 10) + 1)}`.slice(-2),
          section: ["A", "B", "C"][i % 3],
          rollNumber: `${100 + i}`,
          address: "Demo Address",
          photoKey: "demo/photo.jpg",
          status: i % 7 === 0 ? StudentStatus.SCHOOL_APPROVED : StudentStatus.SUBMITTED,
          createdAt,
          updatedAt: createdAt
        }
      });
      await prisma.parentSubmission.create({
        data: {
          schoolId: item.school.id,
          studentId: student.id,
          submittedAt: createdAt,
          payloadJson: { source: "seed", student: student.fullName },
          createdAt
        }
      });

      if (i <= 3) {
        const chain = chainBySchool.get(item.school.id);
        const firstStep = chain?.steps[0];
        const secondStep = chain?.steps[1];
        if (chain && firstStep) {
          if (i === 1) {
            const approvedAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
            const workflow = await prisma.approvalWorkflow.create({
              data: {
                schoolId: item.school.id,
                studentId: student.id,
                chainId: chain.id,
                currentStepId: null,
                status: ApprovalWorkflowStatus.APPROVED,
                startedById: item.admin.id,
                decidedById: mainAdmin.id,
                startedAt: createdAt,
                decidedAt: approvedAt,
                latestComment: "Seed approved workflow"
              }
            });
            await prisma.approvalWorkflowAction.createMany({
              data: [
                {
                  workflowId: workflow.id,
                  stepId: firstStep.id,
                  actorUserId: item.admin.id,
                  action: ApprovalActionType.APPROVE,
                  comment: "Institution approved",
                  fromStatus: ApprovalWorkflowStatus.IN_PROGRESS,
                  toStatus: ApprovalWorkflowStatus.IN_PROGRESS,
                  createdAt
                },
                {
                  workflowId: workflow.id,
                  stepId: secondStep?.id || firstStep.id,
                  actorUserId: mainAdmin.id,
                  action: ApprovalActionType.APPROVE,
                  comment: "Final approved",
                  fromStatus: ApprovalWorkflowStatus.IN_PROGRESS,
                  toStatus: ApprovalWorkflowStatus.APPROVED,
                  createdAt: approvedAt
                }
              ]
            });
            await prisma.approvalRequest.create({
              data: {
                schoolId: item.school.id,
                approvalWorkflowId: workflow.id,
                type: ApprovalRequestType.DATA_AND_DESIGN_APPROVAL,
                status: ApprovalRequestStatus.APPROVED,
                requestedByUserId: item.admin.id,
                approvedByUserId: mainAdmin.id,
                requestedAt: createdAt,
                decidedAt: approvedAt
              }
            });
            await prisma.student.update({
              where: { id: student.id },
              data: {
                intakeStage: IntakeSubmissionStage.APPROVED_FOR_DESIGN,
                status: StudentStatus.SCHOOL_APPROVED
              }
            });
          } else if (i === 2) {
            const workflow = await prisma.approvalWorkflow.create({
              data: {
                schoolId: item.school.id,
                studentId: student.id,
                chainId: chain.id,
                currentStepId: secondStep?.id || firstStep.id,
                status: ApprovalWorkflowStatus.IN_PROGRESS,
                startedById: item.admin.id,
                startedAt: createdAt,
                latestComment: "Pending next approver"
              }
            });
            await prisma.approvalWorkflowAction.create({
              data: {
                workflowId: workflow.id,
                stepId: firstStep.id,
                actorUserId: item.admin.id,
                action: ApprovalActionType.APPROVE,
                comment: "Forwarding to next step",
                fromStatus: ApprovalWorkflowStatus.IN_PROGRESS,
                toStatus: ApprovalWorkflowStatus.IN_PROGRESS,
                createdAt
              }
            });
            await prisma.approvalRequest.create({
              data: {
                schoolId: item.school.id,
                approvalWorkflowId: workflow.id,
                type: ApprovalRequestType.DATA_AND_DESIGN_APPROVAL,
                status: ApprovalRequestStatus.PENDING,
                requestedByUserId: item.admin.id,
                requestedAt: createdAt
              }
            });
            await prisma.student.update({
              where: { id: student.id },
              data: {
                intakeStage: IntakeSubmissionStage.AWAITING_INSTITUTION_APPROVAL,
                status: StudentStatus.SUBMITTED
              }
            });
          } else if (i === 3) {
            const sendBackAt = new Date(createdAt.getTime() + 8 * 60 * 60 * 1000);
            const workflow = await prisma.approvalWorkflow.create({
              data: {
                schoolId: item.school.id,
                studentId: student.id,
                chainId: chain.id,
                currentStepId: firstStep.id,
                status: ApprovalWorkflowStatus.SENT_BACK,
                startedById: item.admin.id,
                startedAt: createdAt,
                latestComment: "Requires correction"
              }
            });
            await prisma.approvalWorkflowAction.create({
              data: {
                workflowId: workflow.id,
                stepId: firstStep.id,
                actorUserId: item.admin.id,
                action: ApprovalActionType.SEND_BACK,
                comment: "Roll number mismatch, please correct",
                fromStatus: ApprovalWorkflowStatus.IN_PROGRESS,
                toStatus: ApprovalWorkflowStatus.SENT_BACK,
                createdAt: sendBackAt
              }
            });
            await prisma.approvalRequest.create({
              data: {
                schoolId: item.school.id,
                approvalWorkflowId: workflow.id,
                type: ApprovalRequestType.DATA_AND_DESIGN_APPROVAL,
                status: ApprovalRequestStatus.PENDING,
                requestedByUserId: item.admin.id,
                requestedAt: createdAt
              }
            });
            await prisma.student.update({
              where: { id: student.id },
              data: {
                intakeStage: IntakeSubmissionStage.SALES_CORRECTED,
                status: StudentStatus.SUBMITTED
              }
            });
          }
        }
      }
    }

    for (let i = 0; i < 8; i++) {
      const issuedAt = new Date(now);
      issuedAt.setDate(now.getDate() - i * 9 - sIndex * 3);
      const total = 15000 + i * 1200 + sIndex * 800;
      const paid = i % 3 === 0 ? total : Math.round(total * 0.65);
      await prisma.invoice.create({
        data: {
          invoiceNo: `INV-${item.school.code}-${issuedAt.getTime()}-${i}`,
          schoolId: item.school.id,
          amount: total,
          taxAmount: Math.round(total * 0.18),
          totalAmount: total + Math.round(total * 0.18),
          amountPaid: paid,
          status: paid >= total ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID",
          issuedAt,
          dueAt: new Date(issuedAt.getTime() + 15 * 24 * 60 * 60 * 1000),
          createdById: mainAdmin.id
        }
      });
      await prisma.cost.create({
        data: {
          schoolId: item.school.id,
          costDate: issuedAt,
          costType: "PRINTING",
          amount: 6000 + i * 350
        }
      });
    }

    for (let i = 0; i < 2; i++) {
      const requestedAt = new Date(now);
      requestedAt.setDate(now.getDate() - (i * 6 + sIndex));
      await prisma.approvalRequest.create({
        data: {
          schoolId: item.school.id,
          type: ApprovalRequestType.DATA_AND_DESIGN_APPROVAL,
          status: i % 3 === 0 ? ApprovalRequestStatus.PENDING : ApprovalRequestStatus.APPROVED,
          requestedByUserId: item.admin.id,
          approvedByUserId: i % 3 === 0 ? null : mainAdmin.id,
          requestedAt,
          decidedAt: i % 3 === 0 ? null : new Date(requestedAt.getTime() + 2 * 24 * 60 * 60 * 1000)
        }
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      actorUserId: mainAdmin.id,
      entityType: "SYSTEM",
      entityId: "seed",
      action: "SEED_V2_OVERVIEW"
    }
  });

  await prisma.intakeLink.createMany({
    data: [
      {
        schoolId: school1.id,
        token: "demo-school-2026",
        campaignName: "Demo School 2026 Parent Intake",
        institutionType: InstitutionType.SCHOOL,
        audience: IntakeAudience.PARENT,
        className: "ALL",
        section: "ALL",
        maxStudentsPerParent: 3,
        photoBgPreference: "WHITE",
        allowSiblings: true,
        allowDraftSave: true,
        photoCaptureRequired: true,
        allowPhotoUpload: true,
        paymentRequired: false,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      },
      {
        schoolId: school2.id,
        token: "demo-college-2026",
        campaignName: "Demo College 2026 Student Self Intake",
        institutionType: InstitutionType.COLLEGE,
        audience: IntakeAudience.STUDENT,
        className: "ALL",
        section: "ALL",
        maxStudentsPerParent: 1,
        photoBgPreference: "WHITE",
        allowSiblings: false,
        allowDraftSave: true,
        photoCaptureRequired: true,
        allowPhotoUpload: true,
        paymentRequired: false,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      },
      {
        schoolId: school3.id,
        token: "demo-company-2026",
        campaignName: "Demo Company 2026 Employee Badge Intake",
        institutionType: InstitutionType.COMPANY,
        audience: IntakeAudience.EMPLOYEE,
        className: "ALL",
        section: "ALL",
        maxStudentsPerParent: 1,
        photoBgPreference: "WHITE",
        allowSiblings: false,
        allowDraftSave: true,
        photoCaptureRequired: true,
        allowPhotoUpload: true,
        paymentRequired: true,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      }
    ]
  });

  console.log("Seed complete:", {
    mainAdmin: "main.admin@demo.com / Admin@123",
    companyAdmin: "company.admin@demo.com / Admin@123",
    sales: ["sales@demo.com / Admin@123", "sales.north@demo.com / Admin@123"],
    printer: "printer@demo.com / Admin@123",
    schoolAdmin: "school.admin@demo.com / Admin@123",
    schoolStaff: "school.staff@demo.com / Admin@123",
    schools: [school1.code, school2.code, school3.code],
    campaignTokens: ["demo-school-2026", "demo-college-2026", "demo-company-2026"]
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
