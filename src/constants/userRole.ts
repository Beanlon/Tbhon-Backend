export const USER_ROLES = ["STAFF", "ADMIN", "PATIENT"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function parseUserRole(raw: unknown): UserRole {
  if (typeof raw === "string" && (USER_ROLES as readonly string[]).includes(raw)) {
    return raw as UserRole;
  }
  return "STAFF";
}

/** Booth screening flows — facility staff and admins only. */
export function canRunScreenings(role: UserRole): boolean {
  return role === "STAFF" || role === "ADMIN";
}
