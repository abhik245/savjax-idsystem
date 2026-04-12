"use strict";

const { PrismaClient, Role } = require("@prisma/client");
const bcrypt = require("bcrypt");

async function main() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  const name = (process.env.ADMIN_NAME || "Main Admin").trim();

  if (!email) {
    throw new Error("ADMIN_EMAIL is required");
  }
  if (!password) {
    throw new Error("ADMIN_PASSWORD is required");
  }
  if (password.length < 10) {
    throw new Error("ADMIN_PASSWORD must be at least 10 characters");
  }

  const prisma = new PrismaClient();

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        role: Role.SUPER_ADMIN,
        passwordHash,
        isActive: true,
        deletedAt: null,
        failedLoginCount: 0,
        lockoutUntil: null,
        forcePasswordReset: false
      },
      create: {
        email,
        name,
        role: Role.SUPER_ADMIN,
        passwordHash,
        isActive: true
      }
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          userId: user.id,
          email: user.email,
          role: user.role
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
