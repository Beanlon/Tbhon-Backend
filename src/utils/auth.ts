import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { parseUserRole, type UserRole } from "../constants/userRole";

function getJwtSecret() {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET is required");
  }

  return jwtSecret;
}

const accessExpiresIn = (process.env.JWT_ACCESS_EXPIRES_IN ??
  process.env.JWT_EXPIRES_IN ??
  "15m") as NonNullable<SignOptions["expiresIn"]>;

export type JwtPayload = {
  userId: string;
  role: UserRole;
};

export function signAccessToken(payload: JwtPayload) {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: accessExpiresIn,
  });
}

/** @deprecated Use signAccessToken — kept as alias for existing imports. */
export const signAuthToken = signAccessToken;

export function verifyAuthToken(token: string): JwtPayload {
  const payload = jwt.verify(token, getJwtSecret());
  if (typeof payload === "string" || !payload || typeof payload !== "object") {
    throw new Error("Invalid auth token");
  }
  const userId = (payload as { userId?: unknown }).userId;
  if (typeof userId !== "string" || !userId.trim()) {
    throw new Error("Invalid auth token");
  }
  const role = parseUserRole((payload as { role?: unknown }).role);
  return { userId, role };
}
