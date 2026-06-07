import { prisma } from "../prisma";
import { sendPasswordResetOtp } from "./email.service";
import {
  canResendVerification,
  generateVerificationCode,
  hashVerificationCode,
  resendCooldownSecondsRemaining,
  verificationExpiresAt,
  verificationTtlMinutes,
} from "../utils/emailVerification";
import { HttpError } from "../utils/http";

export async function issuePasswordResetCode(userId: string, email: string) {
  const existing = await prisma.user.findUnique({
    where: { userId },
    select: { passwordResetSentAt: true },
  });

  if (!canResendVerification(existing?.passwordResetSentAt ?? null)) {
    const seconds = resendCooldownSecondsRemaining(existing?.passwordResetSentAt ?? null);
    throw new HttpError(429, `Please wait ${seconds} seconds before requesting another code.`);
  }

  const code = generateVerificationCode();
  const codeHash = await hashVerificationCode(code);
  const expiresAt = verificationExpiresAt();
  const now = new Date();

  await prisma.user.update({
    where: { userId },
    data: {
      passwordResetCodeHash: codeHash,
      passwordResetExpiresAt: expiresAt,
      passwordResetSentAt: now,
      passwordResetAttemptCount: 0,
    },
  });

  console.log("[auth] Issuing password reset OTP:", { userId, to: email });

  await sendPasswordResetOtp({
    to: email,
    code,
    ttlMinutes: verificationTtlMinutes(),
  });

  return { expiresAt, ttlMinutes: verificationTtlMinutes() };
}
