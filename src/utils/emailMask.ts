/** Mask email for hints, e.g. leblaineresset@gmail.com → l***@gmail.com */
export function maskEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim().toLowerCase();
  if (!trimmed) return null;

  const at = trimmed.indexOf("@");
  if (at <= 0) return null;

  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!domain) return null;

  return `${local[0]}***@${domain}`;
}
