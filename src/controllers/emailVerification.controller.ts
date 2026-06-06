import type { Response } from "express";
import { prisma } from "../prisma";
import type { AuthRequest } from "../types/auth";
import { sendEmailVerificationOtp } from "../services/email.service";
import { HttpError, getString, isRecord } from "../utils/http";
import {
  canResendVerification,
  generateVerificationCode,
  hashVerificationCode,
  isVerificationExpired,
  maxVerifyAttempts,
  resendCooldownSecondsRemaining,
  verificationExpiresAt,
  verificationTtlMinutes,
  verifyVerificationCode,
} from "../utils/emailVerification";

function getAuthenticatedUserId(req: AuthRequest): string {
  const userId = req.user?.userId;
  if (!userId) {
    throw new HttpError(401, "Authorization token is required");
  }
  return userId;
}

async function issueVerificationCode(userId: string, email: string) {
  const existing = await prisma.user.findUnique({
    where: { userId },
    select: { emailVerificationSentAt: true },
  });

  if (!canResendVerification(existing?.emailVerificationSentAt ?? null)) {
    const seconds = resendCooldownSecondsRemaining(existing?.emailVerificationSentAt ?? null);
    throw new HttpError(429, `Please wait ${seconds} seconds before requesting another code.`);
  }

  const code = generateVerificationCode();
  const codeHash = await hashVerificationCode(code);
  const expiresAt = verificationExpiresAt();
  const now = new Date();

  await prisma.user.update({
    where: { userId },
    data: {
      emailVerificationCodeHash: codeHash,
      emailVerificationExpiresAt: expiresAt,
      emailVerificationSentAt: now,
      emailVerificationAttemptCount: 0,
    },
  });

  console.log("[email] Issuing verification OTP:", { userId, to: email });

  await sendEmailVerificationOtp({
    to: email,
    code,
    ttlMinutes: verificationTtlMinutes(),
  });

  return { expiresAt, ttlMinutes: verificationTtlMinutes() };
}

/** Send or resend a 6-digit verification code (authenticated). */
export async function sendEmailVerification(req: AuthRequest, res: Response) {
  const userId = getAuthenticatedUserId(req);

  const user = await prisma.user.findUnique({
    where: { userId },
    select: { email: true, emailVerified: true },
  });

  if (!user) {
    throw new HttpError(404, "User not found");
  }

  if (!user.email) {
    throw new HttpError(400, "No email address on this account");
  }

  if (user.emailVerified) {
    return res.json({ ok: true, message: "Email is already verified", emailVerified: true });
  }

  const { expiresAt, ttlMinutes } = await issueVerificationCode(userId, user.email);

  res.json({
    ok: true,
    message: "Verification code sent",
    emailVerified: false,
    expiresAt: expiresAt.toISOString(),
    ttlMinutes,
  });
}

/** Verify the 6-digit code (authenticated). */
export async function verifyEmail(req: AuthRequest, res: Response) {
  const userId = getAuthenticatedUserId(req);

  if (!isRecord(req.body)) {
    throw new HttpError(400, "Request body is required");
  }

  const code = getString(req.body.code);
  if (!code) {
    throw new HttpError(400, "code is required");
  }

  const user = await prisma.user.findUnique({
    where: { userId },
    select: {
      email: true,
      emailVerified: true,
      emailVerificationCodeHash: true,
      emailVerificationExpiresAt: true,
      emailVerificationAttemptCount: true,
    },
  });

  if (!user) {
    throw new HttpError(404, "User not found");
  }

  if (user.emailVerified) {
    return res.json({ ok: true, message: "Email is already verified", emailVerified: true });
  }

  if (isVerificationExpired(user.emailVerificationExpiresAt)) {
    throw new HttpError(400, "Verification code has expired. Request a new code.");
  }

  if (user.emailVerificationAttemptCount >= maxVerifyAttempts()) {
    throw new HttpError(429, "Too many failed attempts. Request a new code.");
  }

  const valid = await verifyVerificationCode(code, user.emailVerificationCodeHash);
  if (!valid) {
    await prisma.user.update({
      where: { userId },
      data: { emailVerificationAttemptCount: { increment: 1 } },
    });
    throw new HttpError(400, "Invalid verification code");
  }

  const now = new Date();
  await prisma.user.update({
    where: { userId },
    data: {
      emailVerified: true,
      emailVerifiedAt: now,
      emailVerificationCodeHash: null,
      emailVerificationExpiresAt: null,
      emailVerificationAttemptCount: 0,
    },
  });

  res.json({
    ok: true,
    message: "Email verified successfully",
    emailVerified: true,
    emailVerifiedAt: now.toISOString(),
  });
}

/** Used after register — same as send but does not require prior code. */
export async function sendEmailVerificationForUser(userId: string, email: string) {
  return issueVerificationCode(userId, email);
}
