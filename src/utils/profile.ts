import { HttpError, getString, isRecord } from "./http";

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

  return {
    firstName,
    lastName,
    birthdate,
    gender,
    street: getString(value.street) ?? null,
    barangay: getString(value.barangay) ?? null,
    city: getString(value.city) ?? null,
  };
}
