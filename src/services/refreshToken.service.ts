import { createHash, randomBytes } from "crypto";
import { prisma } from "../prisma";

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function refreshTokenExpiresAt(): Date {
  const daysRaw = process.env.REFRESH_TOKEN_TTL_DAYS?.trim();
  const days = daysRaw ? Number.parseInt(daysRaw, 10) : 30;
  const ttlDays = Number.isFinite(days) && days > 0 ? days : 30;
  return new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
}

export function generateRefreshTokenValue(): string {
  return randomBytes(32).toString("base64url");
}

export async function createRefreshToken(userId: string): Promise<string> {
  const token = generateRefreshTokenValue();
  await prisma.authRefreshToken.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(token),
      expiresAt: refreshTokenExpiresAt(),
    },
  });
  return token;
}

type RefreshTokenRecord = {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

async function findActiveRefreshToken(token: string): Promise<RefreshTokenRecord | null> {
  const record = await prisma.authRefreshToken.findFirst({
    where: {
      tokenHash: hashRefreshToken(token),
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      revokedAt: true,
    },
  });
  return record;
}

/** Rotate refresh token and return a new one for the same user. */
export async function rotateRefreshToken(token: string): Promise<{ userId: string; refreshToken: string }> {
  const existing = await findActiveRefreshToken(token);
  if (!existing) {
    throw new Error("Invalid or expired refresh token");
  }

  const newToken = generateRefreshTokenValue();
  const newRecord = await prisma.authRefreshToken.create({
    data: {
      userId: existing.userId,
      tokenHash: hashRefreshToken(newToken),
      expiresAt: refreshTokenExpiresAt(),
    },
  });

  await prisma.authRefreshToken.update({
    where: { id: existing.id },
    data: {
      revokedAt: new Date(),
      replacedById: newRecord.id,
    },
  });

  return { userId: existing.userId, refreshToken: newToken };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const existing = await findActiveRefreshToken(token);
  if (!existing) return;

  await prisma.authRefreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllRefreshTokensForUser(userId: string): Promise<void> {
  await prisma.authRefreshToken.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}
