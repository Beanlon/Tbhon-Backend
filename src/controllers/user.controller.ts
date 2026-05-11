import type { Response } from "express";
import { prisma } from "../prisma";
import type { AuthRequest } from "../types/auth";
import { HttpError, getString, isRecord } from "../utils/http";
import { parseProfileInput } from "../utils/profile";

function getAuthenticatedUserId(req: AuthRequest) {
  const userId = req.user?.userId;

  if (!userId) {
    throw new HttpError(401, "Authentication is required");
  }

  return userId;
}

function toUserResponse(user: {
  userId: string;
  email: string | null;
  phoneNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
  profile?: unknown;
}) {
  return {
    userId: user.userId,
    email: user.email,
    phoneNumber: user.phoneNumber,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    profile: user.profile ?? null,
  };
}

export async function getMe(req: AuthRequest, res: Response) {
  const userId = getAuthenticatedUserId(req);

  const user = await prisma.user.findUnique({
    where: { userId },
    include: {
      profile: true,
    },
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

  const user = await prisma.user.update({
    where: { userId },
    data: {
      ...(email ? { email } : {}),
      ...(phoneNumber ? { phoneNumber } : {}),
    },
    include: {
      profile: true,
    },
  });

  res.json({ user: toUserResponse(user) });
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
