import { randomBytes } from "crypto";

/** Days the result-slip QR remains valid for patient account setup. */
export const PATIENT_ACCESS_TTL_DAYS = 90;

export function generatePatientAccessToken(): string {
  return randomBytes(24).toString("base64url");
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
}) {
  return {
    firstName: client.firstName,
    lastName: client.lastName,
    birthdate: client.birthdate,
    gender: client.gender,
    street: client.street,
    barangay: client.barangay,
    city: client.city,
  };
}
