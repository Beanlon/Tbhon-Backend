import type { Response } from "express";
import { prisma } from "../prisma";
import type { AuthRequest } from "../types/auth";
import { HttpError, getString, isRecord } from "../utils/http";
import { parseProfileInput } from "../utils/profile";
import { toUserResponse, userInclude } from "../utils/userResponse";

function getAuthenticatedUserId(req: AuthRequest) {
  const userId = req.user?.userId;

  if (!userId) {
    throw new HttpError(401, "Authentication is required");
  }

  return userId;
}

export async function getMe(req: AuthRequest, res: Response) {
  const userId = getAuthenticatedUserId(req);

  const user = await prisma.user.findUnique({
    where: { userId },
    include: userInclude,
  });

  if (!user) {
    throw new HttpError(404, "User not found");
  }

  res.json({ user: toUserResponse(user) });
}

export async function updateMe(req: AuthRequest, res: Response) {
  const userId = getAuthenticatedUserId(req);

  if (!isRecord(req.body)) {
    throw new HttpError(400, "Request body is required");
  }

  const email = getString(req.body.email)?.toLowerCase();
  const phoneNumber = getString(req.body.phoneNumber);

  if (!email && !phoneNumber) {
    throw new HttpError(400, "email or phoneNumber is required");
  }

  if (email) {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser && existingUser.userId !== userId) {
      throw new HttpError(409, "Email is already registered");
    }
  }

  const user = await prisma.user.findUnique({ where: { userId }, select: { email: true } });
  const emailChanged = Boolean(email && user?.email !== email);

  const updated = await prisma.user.update({
    where: { userId },
    data: {
      ...(email ? { email } : {}),
      ...(phoneNumber ? { phoneNumber } : {}),
      ...(emailChanged
        ? {
            emailVerified: false,
            emailVerifiedAt: null,
            emailVerificationCodeHash: null,
            emailVerificationExpiresAt: null,
            emailVerificationSentAt: null,
            emailVerificationAttemptCount: 0,
          }
        : {}),
    },
    include: userInclude,
  });

  res.json({ user: toUserResponse(updated) });
}

export async function upsertMyProfile(req: AuthRequest, res: Response) {
  const userId = getAuthenticatedUserId(req);
  const profile = parseProfileInput(req.body);

  const updatedProfile = await prisma.userProfile.upsert({
    where: { userId },
    create: {
      userId,
      ...profile,
    },
    update: profile,
  });

  res.json({ profile: updatedProfile });
}
