import { HttpError, getString, isRecord } from "./http";

const GOVERNMENT_ID_TYPES = new Set([
  "national_id",
  "passport",
  "drivers_license",
  "other",
]);

function optionalString(value: unknown): string | null {
  const s = getString(value);
  return s && s.length > 0 ? s : null;
}

function normalizeGovernmentIdType(raw: string | null): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (GOVERNMENT_ID_TYPES.has(key)) return key;
  return "other";
}

export function parseProfileInput(value: unknown) {
  if (!isRecord(value)) {
    throw new HttpError(400, "Profile payload is required");
  }

  const firstName = getString(value.firstName);
  const lastName = getString(value.lastName);
  const birthdateValue = getString(value.birthdate);
  const gender = getString(value.gender);

  if (!firstName || !lastName || !birthdateValue || !gender) {
    throw new HttpError(400, "firstName, lastName, birthdate, and gender are required");
  }

  const birthdate = new Date(birthdateValue);

  if (Number.isNaN(birthdate.getTime())) {
    throw new HttpError(400, "birthdate must be a valid date");
  }

  const governmentIdNumber = optionalString(value.governmentIdNumber);
  let governmentIdType = normalizeGovernmentIdType(getString(value.governmentIdType) ?? null);
  if (governmentIdNumber && !governmentIdType) {
    governmentIdType = "other";
  }
  if (!governmentIdNumber) {
    governmentIdType = null;
  }

  return {
    firstName,
    lastName,
    birthdate,
    gender,
    street: optionalString(value.street),
    barangay: optionalString(value.barangay),
    city: optionalString(value.city),
    emergencyContactName: optionalString(value.emergencyContactName),
    emergencyContactPhone: optionalString(value.emergencyContactPhone),
    emergencyContactRelation: optionalString(value.emergencyContactRelation),
    governmentIdType,
    governmentIdNumber,
  };
}
