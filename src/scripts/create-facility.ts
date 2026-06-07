/**
 * Create a facility and print its invite code for staff signup.
 *
 * Usage:
 *   npx ts-node --transpile-only src/scripts/create-facility.ts --name "Malay RHU" --code RHU-MALAY-2026 --city Malay
 */
import "../loadEnv";
import { prisma } from "../prisma";
import {
  facilityInviteCodeValidationError,
  generateFacilityInviteCode,
  normalizeFacilityInviteCode,
} from "../utils/facilityInvite";

function readArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const name = readArg("--name")?.trim();
  if (!name) {
    console.error("Usage: create-facility.ts --name \"Facility name\" [--code INVITE-CODE] [--city City] [--barangay Barangay]");
    process.exit(1);
  }

  const rawCode = readArg("--code");
  const inviteCode = rawCode ? normalizeFacilityInviteCode(rawCode) : generateFacilityInviteCode();
  const formatError = facilityInviteCodeValidationError(inviteCode);
  if (formatError) {
    console.error(formatError);
    process.exit(1);
  }

  const city = readArg("--city")?.trim() || null;
  const barangay = readArg("--barangay")?.trim() || null;

  const existing = await prisma.facility.findUnique({ where: { inviteCode } });
  if (existing) {
    console.error(`Invite code already in use: ${inviteCode}`);
    process.exit(1);
  }

  const facility = await prisma.facility.create({
    data: { name, inviteCode, city, barangay },
  });

  console.log("Facility created:");
  console.log(JSON.stringify(facility, null, 2));
  console.log("\nGive this invite code to booth staff at signup:");
  console.log(facility.inviteCode);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
