import type { Response } from "express";
import { prisma } from "../prisma";
import { syncPatientProfileFromLinkedScreening } from "../services/patientProfile.service";
import type { AuthRequest } from "../types/auth";
import { HttpError, getString, isRecord } from "../utils/http";
import { generatePatientPublicCode } from "../utils/patientAccess";
import { parseProfileInput } from "../utils/profile";
import { toUserResponse, userInclude } from "../utils/userResponse";

function getAuthenticatedUserId(req: AuthRequest) {
  const userId = req.user?.userId;

  if (!userId) {
    throw new HttpError(401, "Authentication is required");
  }

  return userId;
}

async function ensurePatientPublicCode(userId: string): Promise<string> {
  const existingUser = await prisma.user.findUnique({
    where: { userId },
    select: { role: true, patientPublicCode: true },
  });

  if (!existingUser) throw new HttpError(404, "User not found");
  if (existingUser.role !== "PATIENT") {
    throw new HttpError(403, "Patient account is required");
  }
  if (existingUser.patientPublicCode) return existingUser.patientPublicCode;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const patientPublicCode = generatePatientPublicCode();
    const existingCode = await prisma.user.findUnique({ where: { patientPublicCode } });
    if (existingCode) continue;

    const updated = await prisma.user.update({
      where: { userId },
      data: { patientPublicCode },
      select: { patientPublicCode: true },
    });
    if (updated.patientPublicCode) return updated.patientPublicCode;
  }

  throw new HttpError(500, "Could not create patient access code");
}

export async function getMe(req: AuthRequest, res: Response) {
  const userId = getAuthenticatedUserId(req);

  if (req.user?.role === "PATIENT") {
    await syncPatientProfileFromLinkedScreening(userId);
  }

  let user = await prisma.user.findUnique({
    where: { userId },
    include: userInclude,
  });

  if (!user) {
    throw new HttpError(404, "User not found");
  }

  if (user.role === "PATIENT" && !user.patientPublicCode) {
    await ensurePatientPublicCode(userId);
    user = await prisma.user.findUnique({
      where: { userId },
      include: userInclude,
    });
    if (!user) throw new HttpError(404, "User not found");
  }

  res.json({ user: toUserResponse(user) });
}

export async function ensureMyPatientCode(req: AuthRequest, res: Response) {
  const userId = getAuthenticatedUserId(req);
  const patientPublicCode = await ensurePatientPublicCode(userId);
  res.json({ patientPublicCode });
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
