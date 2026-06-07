/**
 * Promote a user to ADMIN by email (for managing facilities).
 *
 * Usage:
 *   npx ts-node --transpile-only src/scripts/promote-admin.ts --email admin@example.com
 */
import "../loadEnv";
import { prisma } from "../prisma";

function readArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const email = readArg("--email")?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: promote-admin.ts --email user@example.com");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found for ${email}`);
    process.exit(1);
  }

  const updated = await prisma.user.update({
    where: { userId: user.userId },
    data: { role: "ADMIN", facilityId: null },
  });

  console.log(`Promoted ${updated.email} to ADMIN`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
