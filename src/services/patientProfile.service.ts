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

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
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
  const shouldBackfillIdentity = isProfileIdentityIncomplete(user.profile);
  const supplementalProfileInput = user.profile
    ? {
        ...(!isBlank(session.client.emergencyContactName) && isBlank(user.profile.emergencyContactName)
          ? { emergencyContactName: session.client.emergencyContactName }
          : {}),
        ...(!isBlank(session.client.emergencyContactPhone) && isBlank(user.profile.emergencyContactPhone)
          ? { emergencyContactPhone: session.client.emergencyContactPhone }
          : {}),
        ...(!isBlank(session.client.emergencyContactRelation) && isBlank(user.profile.emergencyContactRelation)
          ? { emergencyContactRelation: session.client.emergencyContactRelation }
          : {}),
        ...(!isBlank(session.client.governmentIdType) && isBlank(user.profile.governmentIdType)
          ? { governmentIdType: session.client.governmentIdType }
          : {}),
        ...(!isBlank(session.client.governmentIdNumber) && isBlank(user.profile.governmentIdNumber)
          ? { governmentIdNumber: session.client.governmentIdNumber }
          : {}),
      }
    : profileInput;
  const hasSupplementalUpdates = Object.keys(supplementalProfileInput).length > 0;

  if (!shouldBackfillIdentity && !hasSupplementalUpdates && (user.phoneNumber?.trim() || !phoneFromIntake)) {
    return false;
  }

  await prisma.$transaction(async (tx) => {
    if (shouldBackfillIdentity || hasSupplementalUpdates) {
      await tx.userProfile.upsert({
        where: { userId },
        create: {
          profileId: randomUUID(),
          userId,
          ...profileInput,
        },
        update: shouldBackfillIdentity ? profileInput : supplementalProfileInput,
      });
    }

    if (!user.phoneNumber?.trim() && phoneFromIntake) {
      await tx.user.update({
        where: { userId },
        data: { phoneNumber: phoneFromIntake },
      });
    }
  });

  return true;
}
