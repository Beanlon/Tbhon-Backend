import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";

const jwtExpiresIn = (process.env.JWT_EXPIRES_IN ?? "7d") as NonNullable<SignOptions["expiresIn"]>;

function getJwtSecret() {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET is required");
  }

  return jwtSecret;
}

export type JwtPayload = {
  userId: string;
};

export function signAuthToken(payload: JwtPayload) {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: jwtExpiresIn,
  });
}

export function verifyAuthToken(token: string) {
  return jwt.verify(token, getJwtSecret()) as unknown as JwtPayload;
}
