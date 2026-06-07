import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma";
import { issuePasswordResetCode } from "../services/passwordReset.service";
import { revokeAllRefreshTokensForUser } from "../services/refreshToken.service";
import type { AuthRequest } from "../types/auth";
import {
  isVerificationExpired,
  maxVerifyAttempts,
  verifyVerificationCode,
} from "../utils/emailVerification";
import { HttpError, getString, isRecord } from "../utils/http";
import { passwordPolicyValidationError } from "../utils/passwordPolicy";

const GENERIC_RESET_MESSAGE =
  "If an account exists for that email, a reset code has been sent.";

function getAuthenticatedUserId(req: AuthRequest): string {
  const userId = req.user?.userId;
  if (!userId) {
    throw new HttpError(401, "Authorization token is required");
  }
  return userId;
}

async function validatePasswordResetCode(userId: string, code: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: {
      passwordResetCodeHash: true,
      passwordResetExpiresAt: true,
      passwordResetAttemptCount: true,
    },
  });

  if (!user) {
    throw new HttpError(404, "User not found");
  }

  if (isVerificationExpired(user.passwordResetExpiresAt)) {
    throw new HttpError(400, "Reset code has expired. Request a new code.");
  }

  if (user.passwordResetAttemptCount >= maxVerifyAttempts()) {
    throw new HttpError(429, "Too many failed attempts. Request a new code.");
  }

  const valid = await verifyVerificationCode(code, user.passwordResetCodeHash);
  if (!valid) {
    await prisma.user.update({
      where: { userId },
      data: { passwordResetAttemptCount: { increment: 1 } },
    });
    throw new HttpError(400, "Invalid reset code");
  }
}

async function applyPasswordReset(userId: string, code: string, newPassword: string) {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: {
      passwordHash: true,
      passwordResetCodeHash: true,
      passwordResetExpiresAt: true,
      passwordResetAttemptCount: true,
    },
  });

  if (!user) {
    throw new HttpError(404, "User not found");
  }

  if (isVerificationExpired(user.passwordResetExpiresAt)) {
    throw new HttpError(400, "Reset code has expired. Request a new code.");
  }

  if (user.passwordResetAttemptCount >= maxVerifyAttempts()) {
    throw new HttpError(429, "Too many failed attempts. Request a new code.");
  }

  const valid = await verifyVerificationCode(code, user.passwordResetCodeHash);
  if (!valid) {
    await prisma.user.update({
      where: { userId },
      data: { passwordResetAttemptCount: { increment: 1 } },
    });
    throw new HttpError(400, "Invalid reset code");
  }

  const sameAsOld = await bcrypt.compare(newPassword, user.passwordHash);
  if (sameAsOld) {
    throw new HttpError(400, "New password must be different from your current password");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { userId },
    data: {
      passwordHash,
      passwordResetCodeHash: null,
      passwordResetExpiresAt: null,
      passwordResetSentAt: null,
      passwordResetAttemptCount: 0,
    },
  });

  await revokeAllRefreshTokensForUser(userId);
}

/** Request a password reset code by email (logged out). */
export async function forgotPassword(req: Request, res: Response) {
  if (!isRecord(req.body)) {
    throw new HttpError(400, "Request body is required");
  }

  const email = getString(req.body.email)?.toLowerCase();
  if (!email) {
    throw new HttpError(400, "email is required");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { userId: true, email: true },
  });

  if (user?.email) {
    try {
      await issuePasswordResetCode(user.userId, user.email);
    } catch (err) {
      if (err instanceof HttpError && err.statusCode === 429) {
        throw err;
      }
      console.error("[auth] Failed to send password reset email:", err);
    }
  }

  res.json({ ok: true, message: GENERIC_RESET_MESSAGE });
}

/** Complete password reset with email + code (logged out). */
export async function resetPassword(req: Request, res: Response) {
  if (!isRecord(req.body)) {
    throw new HttpError(400, "Request body is required");
  }

  const email = getString(req.body.email)?.toLowerCase();
  const code = getString(req.body.code);
  const newPassword = getString(req.body.newPassword);

  if (!email || !code || !newPassword) {
    throw new HttpError(400, "email, code, and newPassword are required");
  }

  const policyError = passwordPolicyValidationError(newPassword);
  if (policyError) {
    throw new HttpError(400, policyError);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { userId: true },
  });

  if (!user) {
    throw new HttpError(400, "Invalid reset code");
  }

  await applyPasswordReset(user.userId, code, newPassword);

  res.json({ ok: true, message: "Password updated successfully" });
}

/** Check reset code before showing the new-password form (logged out). */
export async function verifyForgotPasswordCode(req: Request, res: Response) {
  if (!isRecord(req.body)) {
    throw new HttpError(400, "Request body is required");
  }

  const email = getString(req.body.email)?.toLowerCase();
  const code = getString(req.body.code);

  if (!email || !code) {
    throw new HttpError(400, "email and code are required");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { userId: true },
  });

  if (!user) {
    throw new HttpError(400, "Invalid reset code");
  }

  await validatePasswordResetCode(user.userId, code);

  res.json({ ok: true, message: "Code verified" });
}

/** Send a password reset code to the authenticated user's email. */
export async function sendChangePasswordCode(req: AuthRequest, res: Response) {
  const userId = getAuthenticatedUserId(req);

  const user = await prisma.user.findUnique({
    where: { userId },
    select: { email: true },
  });

  if (!user) {
    throw new HttpError(404, "User not found");
  }

  if (!user.email) {
    throw new HttpError(400, "No email address on this account");
  }

  const { expiresAt, ttlMinutes } = await issuePasswordResetCode(userId, user.email);

  res.json({
    ok: true,
    message: "Reset code sent",
    expiresAt: expiresAt.toISOString(),
    ttlMinutes,
  });
}

/** Check reset code before showing the new-password form (authenticated). */
export async function verifyChangePasswordCode(req: AuthRequest, res: Response) {
  const userId = getAuthenticatedUserId(req);

  if (!isRecord(req.body)) {
    throw new HttpError(400, "Request body is required");
  }

  const code = getString(req.body.code);
  if (!code) {
    throw new HttpError(400, "code is required");
  }

  await validatePasswordResetCode(userId, code);

  res.json({ ok: true, message: "Code verified" });
}

/** Confirm password change with code (authenticated). */
export async function confirmChangePassword(req: AuthRequest, res: Response) {
  const userId = getAuthenticatedUserId(req);

  if (!isRecord(req.body)) {
    throw new HttpError(400, "Request body is required");
  }

  const code = getString(req.body.code);
  const newPassword = getString(req.body.newPassword);

  if (!code || !newPassword) {
    throw new HttpError(400, "code and newPassword are required");
  }

  const policyError = passwordPolicyValidationError(newPassword);
  if (policyError) {
    throw new HttpError(400, policyError);
  }

  await applyPasswordReset(userId, code, newPassword);

  res.json({ ok: true, message: "Password updated successfully" });
}
