import { randomUUID } from "crypto";
import { parseUserRole } from "../constants/userRole";
import { prisma } from "../prisma";
import { profileInputFromScreeningClient } from "../utils/patientAccess";

function isProfileIdentityIncomplete(profile: {
  firstName: string;
  lastName: string;
  birthdate: Date;
  gender: string;
} | null): boolean {
  if (!profile) return true;
  return (
    !profile.firstName.trim() ||
    !profile.lastName.trim() ||
    !profile.gender.trim() ||
    Number.isNaN(profile.birthdate.getTime())
  );
}

/** Backfill PATIENT profile from booth intake on their claimed screening session. */
export async function syncPatientProfileFromLinkedScreening(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { userId },
    include: { profile: true },
  });

  if (!user || parseUserRole(user.role) !== "PATIENT") {
    return false;
  }
  if (!isProfileIdentityIncomplete(user.profile)) {
    return false;
  }

  const session = await prisma.screeningSession.findFirst({
    where: {
      patientUserId: userId,
      client: { isNot: null },
    },
    include: { client: true },
    orderBy: [{ patientClaimedAt: "desc" }, { completedAt: "desc" }],
  });

  if (!session?.client) {
    return false;
  }

  const profileInput = profileInputFromScreeningClient(session.client);
  const phoneFromIntake = session.client.contactNumber.trim();

  await prisma.$transaction(async (tx) => {
    await tx.userProfile.upsert({
      where: { userId },
      create: {
        profileId: randomUUID(),
        userId,
        ...profileInput,
      },
      update: profileInput,
    });

    if (!user.phoneNumber?.trim() && phoneFromIntake) {
      await tx.user.update({
        where: { userId },
        data: { phoneNumber: phoneFromIntake },
      });
    }
  });

  return true;
}
