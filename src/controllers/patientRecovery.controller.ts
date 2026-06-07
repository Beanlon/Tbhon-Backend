import type { Response } from "express";
import { parseUserRole } from "../constants/userRole";
import { prisma } from "../prisma";
import { issuePasswordResetCode } from "../services/passwordReset.service";
import type { AuthRequest } from "../types/auth";
import { formatClientDisplayName } from "../utils/client";
import { maskEmail } from "../utils/emailMask";
import { HttpError, getString } from "../utils/http";

function authenticatedUserId(req: AuthRequest): string {
  const userId = req.user?.userId;
  if (!userId) throw new HttpError(401, "Authentication is required");
  return userId;
}

async function findStaffSessionWithPatient(req: AuthRequest, sessionId: string) {
  const userId = authenticatedUserId(req);
  const session = await prisma.screeningSession.findFirst({
    where: { sessionId, userId },
    include: {
      client: true,
      result: { select: { resultId: true } },
      patientUser: { select: { userId: true, email: true, role: true } },
    },
  });

  if (!session?.result) {
    throw new HttpError(404, "Screening session not found");
  }

  return session;
}

/** GET /screenings/:sessionId/patient-recovery — booth staff sees masked login for linked patient. */
export async function getPatientRecoveryForSession(req: AuthRequest, res: Response) {
  const sessionId = getString(req.params.sessionId);
  if (!sessionId) throw new HttpError(400, "sessionId is required");

  const session = await findStaffSessionWithPatient(req, sessionId);

  if (!session.patientUserId || !session.patientUser) {
    res.json({
      linked: false,
      message: "No patient result account linked to this screening yet.",
    });
    return;
  }

  if (parseUserRole(session.patientUser.role) !== "PATIENT") {
    throw new HttpError(409, "Linked account is not a patient result account");
  }

  res.json({
    linked: true,
    maskedEmail: maskEmail(session.patientUser.email),
    patientClaimedAt: session.patientClaimedAt?.toISOString() ?? null,
    clientName: session.client ? formatClientDisplayName(session.client) : null,
  });
}

/** POST /screenings/:sessionId/patient-recovery/send-reset — staff triggers reset email to patient. */
export async function sendPatientRecoveryPasswordReset(req: AuthRequest, res: Response) {
  const sessionId = getString(req.params.sessionId);
  if (!sessionId) throw new HttpError(400, "sessionId is required");

  const session = await findStaffSessionWithPatient(req, sessionId);

  if (!session.patientUserId || !session.patientUser?.email) {
    throw new HttpError(404, "No patient result account linked to this screening");
  }

  if (parseUserRole(session.patientUser.role) !== "PATIENT") {
    throw new HttpError(409, "Linked account is not a patient result account");
  }

  await issuePasswordResetCode(session.patientUserId, session.patientUser.email);

  res.json({
    ok: true,
    maskedEmail: maskEmail(session.patientUser.email),
    message: `Password reset code sent to ${maskEmail(session.patientUser.email) ?? "the patient's email"}.`,
  });
}
