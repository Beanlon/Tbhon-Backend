import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma";
import { signAuthToken } from "../utils/auth";
import { HttpError, getString, isRecord } from "../utils/http";
import { parseProfileInput } from "../utils/profile";

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

export async function register(req: Request, res: Response) {
  if (!isRecord(req.body)) {
    throw new HttpError(400, "Request body is required");
  }

  const email = getString(req.body.email)?.toLowerCase();
  const phoneNumber = getString(req.body.phoneNumber);
  const password = getString(req.body.password);

  if (!email || !password) {
    throw new HttpError(400, "email and password are required");
  }

  if (password.length < 8) {
    throw new HttpError(400, "password must be at least 8 characters");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new HttpError(409, "Email is already registered");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const profile = req.body.profile === undefined ? undefined : parseProfileInput(req.body.profile);

  const user = await prisma.user.create({
    data: {
      email,
      phoneNumber: phoneNumber ?? null,
      passwordHash,
      ...(profile ? { profile: { create: profile } } : {}),
    },
    include: {
      profile: true,
    },
  });

  const token = signAuthToken({ userId: user.userId });

  res.status(201).json({
    token,
    user: toUserResponse(user),
  });
}

export async function login(req: Request, res: Response) {
  if (!isRecord(req.body)) {
    throw new HttpError(400, "Request body is required");
  }

  const email = getString(req.body.email)?.toLowerCase();
  const password = getString(req.body.password);

  if (!email || !password) {
    throw new HttpError(400, "email and password are required");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      profile: true,
    },
  });

  if (!user) {
    throw new HttpError(401, "Invalid email or password");
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    throw new HttpError(401, "Invalid email or password");
  }

  const token = signAuthToken({ userId: user.userId });

  res.json({
    token,
    user: toUserResponse(user),
  });
}
