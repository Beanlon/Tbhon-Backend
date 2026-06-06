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

/** Demographics and contact info for the person screened. */
export function parseClientInput(value: unknown) {
  if (!isRecord(value)) {
    throw new HttpError(400, "Client payload is required");
  }

  const firstName = getString(value.firstName);
  const middleName = getString(value.middleName);
  const lastName = getString(value.lastName);
  const birthdateValue = getString(value.birthdate);
  const gender = getString(value.gender);
  const contactNumber = getString(value.contactNumber);

  if (!firstName || !lastName || !birthdateValue || !gender) {
    throw new HttpError(400, "firstName, lastName, birthdate, and gender are required");
  }
  if (!contactNumber) {
    throw new HttpError(400, "contactNumber is required");
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
    middleName: middleName ?? null,
    lastName,
    birthdate,
    gender,
    street: optionalString(value.street),
    barangay: optionalString(value.barangay),
    city: optionalString(value.city),
    contactNumber,
    emergencyContactName: optionalString(value.emergencyContactName),
    emergencyContactPhone: optionalString(value.emergencyContactPhone),
    emergencyContactRelation: optionalString(value.emergencyContactRelation),
    governmentIdType,
    governmentIdNumber,
  };
}

export function formatClientDisplayName(client: {
  firstName: string;
  middleName?: string | null;
  lastName: string;
}): string {
  return [client.firstName, client.middleName, client.lastName]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter((part) => part.length > 0)
    .join(" ");
}

export function formatClientAddress(client: {
  street?: string | null;
  barangay?: string | null;
  city?: string | null;
}): string | null {
  const parts = [client.street, client.barangay, client.city]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts.join(", ") : null;
}

export type SerializedScreeningClient = {
  clientId: string;
  sessionId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  birthdate: string;
  gender: string;
  street: string | null;
  barangay: string | null;
  city: string | null;
  contactNumber: string;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  governmentIdType: string | null;
  governmentIdNumber: string | null;
};

export function serializeScreeningClient(
  client: {
    clientId: string;
    sessionId: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    birthdate: Date;
    gender: string;
    street: string | null;
    barangay: string | null;
    city: string | null;
    contactNumber: string;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    emergencyContactRelation: string | null;
    governmentIdType: string | null;
    governmentIdNumber: string | null;
  } | null,
): SerializedScreeningClient | null {
  if (!client) return null;
  return {
    clientId: client.clientId,
    sessionId: client.sessionId,
    firstName: client.firstName,
    middleName: client.middleName,
    lastName: client.lastName,
    birthdate: client.birthdate.toISOString().slice(0, 10),
    gender: client.gender,
    street: client.street,
    barangay: client.barangay,
    city: client.city,
    contactNumber: client.contactNumber,
    emergencyContactName: client.emergencyContactName,
    emergencyContactPhone: client.emergencyContactPhone,
    emergencyContactRelation: client.emergencyContactRelation,
    governmentIdType: client.governmentIdType,
    governmentIdNumber: client.governmentIdNumber,
  };
}
