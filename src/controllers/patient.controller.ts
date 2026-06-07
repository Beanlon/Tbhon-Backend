import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { prisma } from "../prisma";
import { createRefreshToken } from "../services/refreshToken.service";
import { signAccessToken } from "../utils/auth";
import { HttpError, getString, isRecord } from "../utils/http";
import {
  isPatientAccessExpired,
  profileInputFromScreeningClient,
  profilePrefillFromScreeningClient,
} from "../utils/patientAccess";
import { maskEmail } from "../utils/emailMask";
import { parseProfileInput } from "../utils/profile";
import { parseUserRole } from "../constants/userRole";
import { toUserResponse, userInclude } from "../utils/userResponse";

async function findSessionByPatientToken(token: string) {
  return prisma.screeningSession.findFirst({
    where: { patientAccessToken: token },
    include: {
      result: { select: { resultId: true } },
      client: true,
    },
  });
}

async function findClaimableSession(token: string) {
  const session = await findSessionByPatientToken(token);

  if (!session?.result) {
    throw new HttpError(404, "Invalid or expired result access code");
  }
  if (session.patientUserId) {
    throw new HttpError(409, "This result slip has already been linked to a patient account");
  }
  if (isPatientAccessExpired(session.patientAccessExpiresAt)) {
    throw new HttpError(410, "This result access code has expired — ask booth staff for help");
  }

  return session;
}

/** GET /patient/claim/status?token= — whether QR can still be claimed (no error for already linked). */
export async function getPatientClaimStatus(req: Request, res: Response) {
  const token = getString(req.query.token)?.trim();
  if (!token) throw new HttpError(400, "token is required");

  const session = await findSessionByPatientToken(token);

  if (!session?.result) {
    res.json({
      status: "invalid",
      message: "Invalid or expired result access code",
    });
    return;
  }

  if (session.patientUserId) {
    const patient = await prisma.user.findUnique({
      where: { userId: session.patientUserId },
      select: { email: true },
    });
    const maskedEmail = maskEmail(patient?.email);
    const message = maskedEmail
      ? `This result slip is already linked to ${maskedEmail}. Sign in with that email, or use Forgot password if you need a new password.`
      : "This result slip is already linked to an account. Sign in with the email and password you chose when you set it up.";

    res.json({
      status: "claimed",
      maskedEmail,
      message,
    });
    return;
  }

  if (isPatientAccessExpired(session.patientAccessExpiresAt)) {
    res.json({
      status: "expired",
      message: "This result access code has expired — ask booth staff for help",
    });
    return;
  }

  res.json({
    status: "available",
    sessionId: session.sessionId,
    profile: session.client ? profilePrefillFromScreeningClient(session.client) : null,
    fromBoothIntake: Boolean(session.client),
  });
}

/** GET /patient/claim/preview?token= — profile fields pre-filled from booth client intake. */
export async function previewPatientClaim(req: Request, res: Response) {
  const token = getString(req.query.token)?.trim();
  if (!token) throw new HttpError(400, "token is required");

  const session = await findClaimableSession(token);
  const profile = session.client ? profilePrefillFromScreeningClient(session.client) : null;

  res.json({
    sessionId: session.sessionId,
    profile,
    fromBoothIntake: Boolean(session.client),
  });
}

/** POST /patient/claim — screened person sets up a PATIENT account from result-slip QR. */
export async function claimPatientAccess(req: Request, res: Response) {
  if (!isRecord(req.body)) {
    throw new HttpError(400, "Request body is required");
  }

  const token = getString(req.body.token)?.trim();
  const email = getString(req.body.email)?.toLowerCase();
  const password = getString(req.body.password);
  const phoneNumber = getString(req.body.phoneNumber);

  if (!token) throw new HttpError(400, "token is required");
  if (!email || !password) throw new HttpError(400, "email and password are required");
  if (password.length < 8) throw new HttpError(400, "password must be at least 8 characters");

  const session = await findClaimableSession(token);

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new HttpError(409, "Email is already registered — sign in instead");
  }

  let profileInput =
    req.body.profile === undefined ? undefined : parseProfileInput(req.body.profile);
  if (!profileInput && session.client) {
    profileInput = profileInputFromScreeningClient(session.client);
  }
  if (!profileInput) {
    throw new HttpError(400, "Profile information is required");
  }

  const resolvedPhone =
    phoneNumber?.trim() ||
    (session.client?.contactNumber ? session.client.contactNumber.trim() : null);

  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        phoneNumber: resolvedPhone,
        passwordHash,
        role: "PATIENT",
        emailVerified: true,
        emailVerifiedAt: now,
        profile: {
          create: {
            profileId: randomUUID(),
            ...profileInput,
          },
        },
      },
      include: userInclude,
    });

    await tx.screeningSession.update({
      where: { sessionId: session.sessionId },
      data: {
        patientUserId: created.userId,
        patientClaimedAt: now,
      },
    });

    return created;
  });

  const role = parseUserRole(user.role);
  const accessToken = signAccessToken({ userId: user.userId, role });
  const refreshToken = await createRefreshToken(user.userId);

  res.status(201).json({
    accessToken,
    refreshToken,
    token: accessToken,
    user: toUserResponse(user),
    sessionId: session.sessionId,
  });
}
