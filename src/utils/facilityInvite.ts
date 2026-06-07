/** Normalize facility invite codes for lookup (uppercase, no spaces). */
export function normalizeFacilityInviteCode(raw: string): string {
  return raw.trim().replace(/\s+/g, "").toUpperCase();
}

const INVITE_CODE_PATTERN = /^[A-Z0-9-]{6,64}$/;

export function facilityInviteCodeValidationError(raw: string): string | null {
  const normalized = normalizeFacilityInviteCode(raw);
  if (!normalized) {
    return "Facility invite code is required.";
  }
  if (!INVITE_CODE_PATTERN.test(normalized)) {
    return "Use 6–64 letters, numbers, or hyphens (e.g. RHU-MALAY-2026).";
  }
  return null;
}

/** Generate a readable invite code for new facilities. */
export function generateFacilityInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segment = (len: number) =>
    Array.from({ length: len }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `TBHON-${segment(4)}-${segment(4)}`;
}
