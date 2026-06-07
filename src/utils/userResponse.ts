import { parseUserRole, type UserRole } from "../constants/userRole";
import { toFacilitySummary } from "../services/facility.service";

export function toUserResponse(user: {
  userId: string;
  email: string | null;
  phoneNumber: string | null;
  emailVerified: boolean;
  emailVerifiedAt: Date | null;
  role?: UserRole | string | null;
  createdAt: Date;
  updatedAt: Date;
  profile?: unknown;
  facility?: {
    facilityId: string;
    name: string;
    city: string | null;
    barangay: string | null;
  } | null;
}) {
  return {
    userId: user.userId,
    email: user.email,
    phoneNumber: user.phoneNumber,
    emailVerified: user.emailVerified,
    emailVerifiedAt: user.emailVerifiedAt,
    role: parseUserRole(user.role),
    facility: user.facility ? toFacilitySummary(user.facility) : null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    profile: user.profile ?? null,
  };
}

export const userInclude = {
  profile: true,
  facility: {
    select: {
      facilityId: true,
      name: true,
      city: true,
      barangay: true,
    },
  },
} as const;
