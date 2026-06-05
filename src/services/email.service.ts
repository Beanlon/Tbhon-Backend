import nodemailer from "nodemailer";
import type Transporter from "nodemailer/lib/mailer";

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
};

function getSmtpConfig(): SmtpConfig | null {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!user || !pass) return null;

  const portRaw = process.env.SMTP_PORT?.trim();
  const port = portRaw ? Number.parseInt(portRaw, 10) : 587;

  return {
    host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port: Number.isFinite(port) ? port : 587,
    user,
    pass,
  };
}

function getFromAddress(): string {
  const from = process.env.EMAIL_FROM?.trim();
  if (from) return from;
  const user = process.env.SMTP_USER?.trim();
  if (user) return `TBhon <${user}>`;
  return "TBhon <noreply@tbhon.local>";
}

function createTransporter(cfg: SmtpConfig): Transporter {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
  });
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

  const from = getFromAddress();
  const smtp = getSmtpConfig();

  if (!smtp) {
    if (process.env.NODE_ENV !== "production" || process.env.EMAIL_DEV_LOG_CODE === "true") {
      console.log(`[email] SMTP not configured — verification code for ${args.to}: ${args.code}`);
      return;
    }
    throw new Error("SMTP_USER and SMTP_PASS are required to send verification emails");
  }

  const transporter = createTransporter(smtp);

  try {
    const info = await transporter.sendMail({
      from,
      to: args.to,
      subject,
      text,
      html,
    });

    console.log("[email] Gmail SMTP sent verification email:", {
      to: args.to,
      from,
      messageId: info.messageId ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] Gmail SMTP send failed:", { to: args.to, from, message });
    throw new Error(message || "Failed to send verification email");
  }
}

export function logEmailConfigAtStartup(): void {
  const smtp = getSmtpConfig();
  const from = getFromAddress();

  if (!smtp) {
    console.warn(
      "[email] SMTP_USER/SMTP_PASS not set — OTP emails will not send (codes may log to console if EMAIL_DEV_LOG_CODE=true).",
    );
    return;
  }

  console.log(
    `[email] Gmail SMTP configured (host=${smtp.host}, port=${smtp.port}, from=${from}). Use a Google App Password, not your login password.`,
  );

  void createTransporter(smtp)
    .verify()
    .then(() => {
      console.log("[email] Gmail SMTP connection verified.");
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[email] Gmail SMTP verify failed:", message);
    });
}
