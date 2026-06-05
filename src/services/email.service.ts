import { Resend } from "resend";

function getFromAddress(): string {
  return process.env.EMAIL_FROM ?? "TBhon <onboarding@resend.dev>";
}

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

export async function sendEmailVerificationOtp(args: {
  to: string;
  code: string;
  ttlMinutes: number;
}): Promise<void> {
  const subject = "Your TBhon verification code";
  const text = [
    "Verify your email for TBhon",
    "",
    `Your verification code is: ${args.code}`,
    "",
    `This code expires in ${args.ttlMinutes} minutes.`,
    "If you did not create a TBhon account, you can ignore this email.",
  ].join("\n");

  const html = `
    <p>Verify your email for <strong>TBhon</strong>.</p>
    <p style="font-size:28px;font-weight:bold;letter-spacing:4px;margin:16px 0;">${args.code}</p>
    <p>This code expires in <strong>${args.ttlMinutes} minutes</strong>.</p>
    <p style="color:#666;font-size:13px;">If you did not create a TBhon account, you can ignore this email.</p>
  `.trim();

  const client = getResendClient();
  if (!client) {
    if (process.env.NODE_ENV !== "production" || process.env.EMAIL_DEV_LOG_CODE === "true") {
      console.log(`[email] RESEND_API_KEY not set — verification code for ${args.to}: ${args.code}`);
      return;
    }
    throw new Error("RESEND_API_KEY is required to send verification emails");
  }

  const { error } = await client.emails.send({
    from: getFromAddress(),
    to: args.to,
    subject,
    text,
    html,
  });

  if (error) {
    throw new Error(error.message || "Failed to send verification email");
  }
}
