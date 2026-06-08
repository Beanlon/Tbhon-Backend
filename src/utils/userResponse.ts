import { parseUserRole, type UserRole } from "../constants/userRole";
import { toFacilitySummary } from "../services/facility.service";

export function toUserResponse(user: {
  userId: string;
  email: string | null;
  phoneNumber: string | null;
  emailVerified: boolean;
  emailVerifiedAt: Date | null;
  role?: UserRole | string | null;
  patientPublicCode?: string | null;
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
  const role = parseUserRole(user.role);
  return {
    userId: user.userId,
    email: user.email,
    phoneNumber: user.phoneNumber,
    emailVerified: user.emailVerified,
    emailVerifiedAt: user.emailVerifiedAt,
    role,
    facility: user.facility ? toFacilitySummary(user.facility) : null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    profile: user.profile ?? null,
    /** Only populated for PATIENT accounts — used for permanent "My TBhon QR". */
    patientPublicCode: role === "PATIENT" ? (user.patientPublicCode ?? null) : null,
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

/** Minimal user select for patient lookup responses — no sensitive fields. */
export const patientLookupSelect = {
  userId: true,
  email: true,
  patientPublicCode: true,
  role: true,
  profile: {
    select: {
      firstName: true,
      lastName: true,
      birthdate: true,
      gender: true,
      street: true,
      barangay: true,
      city: true,
    },
  },
} as const;
