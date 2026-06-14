import { randomBytes } from "crypto";

/** Days the result-slip QR remains valid for patient account setup. */
export const PATIENT_ACCESS_TTL_DAYS = 90;

export function generatePatientAccessToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Stable public code for a PATIENT account — used in permanent "My TBhon QR". */
export function generatePatientPublicCode(): string {
  return randomBytes(8).toString("base64url");
}

export function buildPatientIdUrl(code: string): string {
  return `tbhon://patient/id?code=${encodeURIComponent(code)}`;
}

export function buildPatientClaimUrl(token: string): string {
  return `tbhon://patient/claim?token=${encodeURIComponent(token)}`;
}

export function patientAccessExpiresAt(from = new Date()): Date {
  const expires = new Date(from);
  expires.setDate(expires.getDate() + PATIENT_ACCESS_TTL_DAYS);
  return expires;
}

export function isPatientAccessExpired(expiresAt: Date | null | undefined, now = new Date()): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() <= now.getTime();
}

export function profilePrefillFromScreeningClient(client: {
  firstName: string;
  lastName: string;
  birthdate: Date;
  gender: string;
  street: string | null;
  barangay: string | null;
  city: string | null;
  contactNumber: string;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  governmentIdType?: string | null;
  governmentIdNumber?: string | null;
}) {
  return {
    firstName: client.firstName,
    lastName: client.lastName,
    birthdate: client.birthdate.toISOString().slice(0, 10),
    gender: client.gender,
    street: client.street,
    barangay: client.barangay,
    city: client.city,
    phoneNumber: client.contactNumber,
    emergencyContactName: client.emergencyContactName ?? null,
    emergencyContactPhone: client.emergencyContactPhone ?? null,
    emergencyContactRelation: client.emergencyContactRelation ?? null,
    governmentIdType: client.governmentIdType ?? null,
    governmentIdNumber: client.governmentIdNumber ?? null,
  };
}

export function profileInputFromScreeningClient(client: {
  firstName: string;
  lastName: string;
  birthdate: Date;
  gender: string;
  street: string | null;
  barangay: string | null;
  city: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  governmentIdType?: string | null;
  governmentIdNumber?: string | null;
}) {
  return {
    firstName: client.firstName,
    lastName: client.lastName,
    birthdate: client.birthdate,
    gender: client.gender,
    street: client.street,
    barangay: client.barangay,
    city: client.city,
    emergencyContactName: client.emergencyContactName ?? null,
    emergencyContactPhone: client.emergencyContactPhone ?? null,
    emergencyContactRelation: client.emergencyContactRelation ?? null,
    governmentIdType: client.governmentIdType ?? null,
    governmentIdNumber: client.governmentIdNumber ?? null,
  };
}
