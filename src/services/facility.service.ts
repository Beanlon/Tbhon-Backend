import { prisma } from "../prisma";
import { HttpError } from "../utils/http";
import { normalizeFacilityInviteCode } from "../utils/facilityInvite";

export async function findActiveFacilityByInviteCode(rawCode: string) {
  const inviteCode = normalizeFacilityInviteCode(rawCode);
  if (!inviteCode) {
    return null;
  }

  return prisma.facility.findFirst({
    where: {
      inviteCode,
      isActive: true,
    },
  });
}

export async function resolveFacilityForRegistration(rawCode: string) {
  const facility = await findActiveFacilityByInviteCode(rawCode);
  if (!facility) {
    throw new HttpError(403, "Invalid or inactive facility invite code.");
  }
  return facility;
}

export function toFacilitySummary(facility: {
  facilityId: string;
  name: string;
  city: string | null;
  barangay: string | null;
}) {
  return {
    facilityId: facility.facilityId,
    name: facility.name,
    city: facility.city,
    barangay: facility.barangay,
  };
}
