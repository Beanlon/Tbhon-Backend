import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma";
import { sendEmailVerificationForUser } from "./emailVerification.controller";
import {
  createRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
} from "../services/refreshToken.service";
import { resolveFacilityForRegistration } from "../services/facility.service";
import { signAccessToken } from "../utils/auth";
import { facilityInviteCodeValidationError } from "../utils/facilityInvite";
import { HttpError, getString, isRecord } from "../utils/http";
import { parseProfileInput } from "../utils/profile";
import { parseUserRole } from "../constants/userRole";
import { toUserResponse, userInclude } from "../utils/userResponse";
import { passwordPolicyValidationError } from "../utils/passwordPolicy";

async function issueAuthSession(userId: string) {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { role: true },
  });
  const role = parseUserRole(user?.role);
  const accessToken = signAccessToken({ userId, role });
  const refreshToken = await createRefreshToken(userId);
  return { accessToken, refreshToken, token: accessToken };
}

function toAuthResponse(session: { accessToken: string; refreshToken: string; token: string }, user: unknown) {
  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    token: session.token,
    user,
  };
}

export async function register(req: Request, res: Response) {
  if (!isRecord(req.body)) {
    throw new HttpError(400, "Request body is required");
  }

  const email = getString(req.body.email)?.toLowerCase();
  const phoneNumber = getString(req.body.phoneNumber);
  const password = getString(req.body.password);
  const facilityInviteCode =
    getString(req.body.facilityInviteCode) ?? getString(req.body.inviteCode);

  if (!email || !password) {
    throw new HttpError(400, "email and password are required");
  }

  const inviteError = facilityInviteCodeValidationError(facilityInviteCode ?? "");
  if (inviteError) {
    throw new HttpError(400, inviteError);
  }

  const facility = await resolveFacilityForRegistration(facilityInviteCode!);

  const passwordError = passwordPolicyValidationError(password);
  if (passwordError) throw new HttpError(400, passwordError);

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
      facilityId: facility.facilityId,
      ...(profile ? { profile: { create: profile } } : {}),
    },
    include: userInclude,
  });

  const session = await issueAuthSession(user.userId);

  let emailVerificationSent = false;
  try {
    await sendEmailVerificationForUser(user.userId, email);
    emailVerificationSent = true;
  } catch (err) {
    console.error("[auth] Failed to send registration verification email:", err);
  }

  res.status(201).json({
    ...toAuthResponse(session, toUserResponse(user)),
    emailVerificationSent,
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
    include: userInclude,
  });

  if (!user) {
    throw new HttpError(401, "Invalid email or password");
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    throw new HttpError(401, "Invalid email or password");
  }

  const session = await issueAuthSession(user.userId);

  res.json(toAuthResponse(session, toUserResponse(user)));
}

/** Exchange a refresh token for a new access + refresh token pair (rotation). */
export async function refreshSession(req: Request, res: Response) {
  if (!isRecord(req.body)) {
    throw new HttpError(400, "Request body is required");
  }

  const refreshToken = getString(req.body.refreshToken);
  if (!refreshToken) {
    throw new HttpError(400, "refreshToken is required");
  }

  try {
    const rotated = await rotateRefreshToken(refreshToken);
    const user = await prisma.user.findUnique({
      where: { userId: rotated.userId },
      select: { role: true },
    });
    const role = parseUserRole(user?.role);
    const accessToken = signAccessToken({ userId: rotated.userId, role });
    res.json({
      accessToken,
      refreshToken: rotated.refreshToken,
      token: accessToken,
    });
  } catch {
    throw new HttpError(401, "Invalid or expired refresh token");
  }
}

/** Revoke the current refresh token (logout). */
export async function logout(req: Request, res: Response) {
  if (!isRecord(req.body)) {
    throw new HttpError(400, "Request body is required");
  }

  const refreshToken = getString(req.body.refreshToken);
  if (!refreshToken) {
    throw new HttpError(400, "refreshToken is required");
  }

  await revokeRefreshToken(refreshToken);
  res.json({ ok: true, message: "Logged out" });
}
