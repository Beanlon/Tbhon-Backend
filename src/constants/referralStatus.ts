export const REFERRAL_STATUSES = ["none", "recommended", "documented", "completed"] as const;

export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

export function parseReferralStatus(raw: unknown): ReferralStatus | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase();
  return (REFERRAL_STATUSES as readonly string[]).includes(normalized)
    ? (normalized as ReferralStatus)
    : null;
}

export function referralStatusForRisk(riskLevel: "low" | "moderate" | "high"): ReferralStatus {
  return riskLevel === "low" ? "none" : "recommended";
}
