import nodemailer from "nodemailer";
import type Transporter from "nodemailer/lib/mailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
};

type EmailAddress = {
  name?: string;
  email: string;
};

type OtpEmailContent = {
  subject: string;
  text: string;
  html: string;
};

function shouldLogOtpForAlpha(): boolean {
  return process.env.EMAIL_DEV_LOG_CODE === "true";
}

function getBrevoApiKey(): string | null {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  return apiKey || null;
}

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

function parseEmailAddress(value: string): EmailAddress {
  const trimmed = value.trim();
  const match = /^(.+?)\s*<([^>]+)>$/.exec(trimmed);
  if (match?.[1] && match[2]) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { email: trimmed };
}

function getFromAddress(): string {
  const from = process.env.EMAIL_FROM?.trim();
  if (from) return from;

  const brevoSender = process.env.BREVO_SENDER_EMAIL?.trim();
  if (brevoSender) return `TBhon <${brevoSender}>`;

  const user = process.env.SMTP_USER?.trim();
  if (user) return `TBhon <${user}>`;

  return "TBhon <noreply@tbhon.local>";
}

function buildOtpEmailContent(args: { code: string; ttlMinutes: number }): OtpEmailContent {
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

  return { subject, text, html };
}

function createTransporter(cfg: SmtpConfig): Transporter {
  // family is supported at runtime but missing from @types/nodemailer SMTPConnection.Options.
  const options = {
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    // VPS droplets often lack IPv6; Node otherwise picks Gmail's AAAA record and ENETUNREACH.
    family: 4,
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
  } as SMTPTransport.Options;

  return nodemailer.createTransport(options);
}

async function sendViaBrevo(args: {
  to: string;
  content: OtpEmailContent;
}): Promise<{ messageId: string | null }> {
  const apiKey = getBrevoApiKey();
  if (!apiKey) {
    throw new Error("BREVO_API_KEY is not set");
  }

  const sender = parseEmailAddress(getFromAddress());
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender,
      to: [{ email: args.to }],
      subject: args.content.subject,
      textContent: args.content.text,
      htmlContent: args.content.html,
    }),
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`Brevo API ${response.status}: ${bodyText}`);
  }

  let messageId: string | null = null;
  if (bodyText) {
    try {
      const parsed = JSON.parse(bodyText) as { messageId?: string };
      messageId = parsed.messageId ?? null;
    } catch {
      messageId = null;
    }
  }

  return { messageId };
}

async function sendViaSmtp(args: {
  to: string;
  content: OtpEmailContent;
}): Promise<{ messageId: string | null }> {
  const smtp = getSmtpConfig();
  if (!smtp) {
    throw new Error("SMTP_USER and SMTP_PASS are not set");
  }

  const from = getFromAddress();
  const transporter = createTransporter(smtp);
  const info = await transporter.sendMail({
    from,
    to: args.to,
    subject: args.content.subject,
    text: args.content.text,
    html: args.content.html,
  });

  return { messageId: info.messageId ?? null };
}

function logAlphaFallback(to: string, code: string, reason: string): void {
  console.log(`[email] ${reason} — alpha fallback code for ${to}: ${code}`);
}

export async function sendEmailVerificationOtp(args: {
  to: string;
  code: string;
  ttlMinutes: number;
}): Promise<void> {
  const content = buildOtpEmailContent(args);
  const from = getFromAddress();
  const brevoApiKey = getBrevoApiKey();
  const smtp = getSmtpConfig();

  if (!brevoApiKey && !smtp) {
    if (process.env.NODE_ENV !== "production" || shouldLogOtpForAlpha()) {
      logAlphaFallback(args.to, args.code, "Email provider not configured");
      return;
    }
    throw new Error("BREVO_API_KEY or SMTP_USER/SMTP_PASS is required to send verification emails");
  }

  try {
    const result = brevoApiKey
      ? await sendViaBrevo({ to: args.to, content })
      : await sendViaSmtp({ to: args.to, content });

    console.log(`[email] ${brevoApiKey ? "Brevo" : "SMTP"} sent verification email:`, {
      to: args.to,
      from,
      messageId: result.messageId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[email] ${brevoApiKey ? "Brevo" : "SMTP"} send failed:`, {
      to: args.to,
      from,
      message,
    });

    if (shouldLogOtpForAlpha()) {
      logAlphaFallback(args.to, args.code, "Email send failed");
      return;
    }

    throw new Error(message || "Failed to send verification email");
  }
}

export function logEmailConfigAtStartup(): void {
  const from = getFromAddress();
  const brevoApiKey = getBrevoApiKey();
  const smtp = getSmtpConfig();

  if (brevoApiKey) {
    console.log(`[email] Brevo API configured (from=${from}). Sender must be verified in Brevo.`);
    return;
  }

  if (!smtp) {
    console.warn(
      "[email] BREVO_API_KEY and SMTP_USER/SMTP_PASS not set — OTP emails will not send (codes may log to console if EMAIL_DEV_LOG_CODE=true).",
    );
    return;
  }

  console.log(`[email] SMTP configured (host=${smtp.host}, port=${smtp.port}, from=${from}).`);

  void createTransporter(smtp)
    .verify()
    .then(() => {
      console.log("[email] SMTP connection verified.");
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[email] SMTP verify failed:", message);
      if (/timeout|ENETUNREACH|ECONNREFUSED|EHOSTUNREACH/i.test(message)) {
        console.error(
          "[email] Hint: VPS hosts often block outbound SMTP. Prefer BREVO_API_KEY (HTTPS) instead of SMTP.",
        );
      }
    });
}
