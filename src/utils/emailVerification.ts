import bcrypt from "bcryptjs";
import { randomInt } from "crypto";

const CODE_LENGTH = 6;
const DEFAULT_TTL_MINUTES = 15;
const MIN_RESEND_SECONDS = 60;
const MAX_VERIFY_ATTEMPTS = 5;

export function verificationTtlMinutes(): number {
  const raw = process.env.EMAIL_VERIFICATION_CODE_TTL_MINUTES;
  const n = raw ? Number.parseInt(raw, 10) : DEFAULT_TTL_MINUTES;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TTL_MINUTES;
}

export function generateVerificationCode(): string {
  const max = 10 ** CODE_LENGTH;
  const n = randomInt(0, max);
  return String(n).padStart(CODE_LENGTH, "0");
}

export async function hashVerificationCode(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

export async function verifyVerificationCode(code: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;
  const normalized = code.replace(/\D/g, "");
  if (normalized.length !== CODE_LENGTH) return false;
  return bcrypt.compare(normalized, hash);
}

export function verificationExpiresAt(from = new Date()): Date {
  return new Date(from.getTime() + verificationTtlMinutes() * 60 * 1000);
}

export function canResendVerification(sentAt: Date | null): boolean {
  if (!sentAt) return true;
  const elapsed = Date.now() - sentAt.getTime();
  return elapsed >= MIN_RESEND_SECONDS * 1000;
}

export function resendCooldownSecondsRemaining(sentAt: Date | null): number {
  if (!sentAt) return 0;
  const remaining = MIN_RESEND_SECONDS * 1000 - (Date.now() - sentAt.getTime());
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

export function isVerificationExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() < Date.now();
}

export function maxVerifyAttempts(): number {
  return MAX_VERIFY_ATTEMPTS;
}

