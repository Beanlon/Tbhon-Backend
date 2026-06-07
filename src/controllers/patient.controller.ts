import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { prisma } from "../prisma";
import { createRefreshToken } from "../services/refreshToken.service";
import { signAccessToken } from "../utils/auth";
import { HttpError, getString, isRecord } from "../utils/http";
import { isPatientAccessExpired } from "../utils/patientAccess";
import { parseProfileInput } from "../utils/profile";
import { parseUserRole } from "../constants/userRole";
import { toUserResponse, userInclude } from "../utils/userResponse";

/** POST /patient/claim — screened person sets up a PATIENT account from result-slip QR. */
export async function claimPatientAccess(req: Request, res: Response) {
  if (!isRecord(req.body)) {
    throw new HttpError(400, "Request body is required");
  }

  const token = getString(req.body.token)?.trim();
  const email = getString(req.body.email)?.toLowerCase();
  const password = getString(req.body.password);

  if (!token) throw new HttpError(400, "token is required");
  if (!email || !password) throw new HttpError(400, "email and password are required");
  if (password.length < 8) throw new HttpError(400, "password must be at least 8 characters");

  const session = await prisma.screeningSession.findFirst({
    where: { patientAccessToken: token },
    include: { result: { select: { resultId: true } } },
  });

  if (!session?.result) {
    throw new HttpError(404, "Invalid or expired result access code");
  }
  if (session.patientUserId) {
    throw new HttpError(409, "This result slip has already been linked to a patient account");
  }
  if (isPatientAccessExpired(session.patientAccessExpiresAt)) {
    throw new HttpError(410, "This result access code has expired — ask booth staff for help");
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new HttpError(409, "Email is already registered — sign in instead");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const profile = req.body.profile === undefined ? undefined : parseProfileInput(req.body.profile);
  const now = new Date();

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        passwordHash,
        role: "PATIENT",
        emailVerified: true,
        emailVerifiedAt: now,
        ...(profile
          ? {
              profile: {
                create: {
                  profileId: randomUUID(),
                  ...profile,
                },
              },
            }
          : {}),
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
