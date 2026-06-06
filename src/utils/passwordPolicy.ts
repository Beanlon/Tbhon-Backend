const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_SYMBOL_RE = /[^A-Za-z0-9]/;

const REQUIREMENTS = [
  { test: (p: string) => p.length >= PASSWORD_MIN_LENGTH, label: `at least ${PASSWORD_MIN_LENGTH} characters` },
  { test: (p: string) => /[A-Z]/.test(p), label: "1 uppercase letter" },
  { test: (p: string) => /[a-z]/.test(p), label: "1 lowercase letter" },
  { test: (p: string) => /\d/.test(p), label: "1 number" },
  { test: (p: string) => PASSWORD_SYMBOL_RE.test(p), label: "1 symbol" },
] as const;

export function isPasswordPolicyValid(password: string): boolean {
  return REQUIREMENTS.every((r) => r.test(password));
}

export function passwordPolicyValidationError(password: string): string | null {
  if (!password) return "newPassword is required";
  if (isPasswordPolicyValid(password)) return null;
  return "Password must include uppercase, lowercase, a number, a symbol, and be at least 8 characters";
}
