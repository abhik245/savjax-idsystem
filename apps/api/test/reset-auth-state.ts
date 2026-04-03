import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [users, sessions, resetTokens, otpChallenges] = await prisma.$transaction([
    prisma.user.updateMany({
      data: {
        failedLoginCount: 0,
        lockoutUntil: null
      }
    }),
    prisma.authSession.deleteMany({}),
    prisma.passwordResetToken.deleteMany({}),
    prisma.otpChallenge.deleteMany({})
  ]);

  console.log(
    JSON.stringify(
      {
        message: "Local auth state reset complete",
        usersCleared: users.count,
        sessionsDeleted: sessions.count,
        resetTokensDeleted: resetTokens.count,
        otpChallengesDeleted: otpChallenges.count,
        note: "Restart the API dev server to clear in-memory rate-limit windows."
      },
      null,
      2
    )
  );
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
