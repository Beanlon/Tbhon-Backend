"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendVerificationEmail = sendVerificationEmail;
exports.getEmailDeliveryErrorMessage = getEmailDeliveryErrorMessage;
const nodemailer_1 = __importDefault(require("nodemailer"));
function getSmtpConfig() {
    const user = process.env.SMTP_USER ?? process.env.EMAIL_USER;
    const pass = process.env.SMTP_PASS ?? process.env.EMAIL_APP_PASSWORD;
    const host = process.env.SMTP_HOST ?? (user?.endsWith("@gmail.com") ? "smtp.gmail.com" : undefined);
    const port = Number(process.env.SMTP_PORT ?? 465);
    const secure = (process.env.SMTP_SECURE ?? "true").toLowerCase() !== "false";
    const from = process.env.SMTP_FROM ?? process.env.EMAIL_FROM ?? user;
    if (!host || !user || !pass || !from) {
        throw new Error("SMTP credentials are not configured");
    }
    return { host, port, secure, user, pass, from };
}
async function sendVerificationEmail({ to, code }) {
    const { host, port, secure, user, pass, from } = getSmtpConfig();
    const transporter = nodemailer_1.default.createTransport({
        host,
        port,
        secure,
        auth: {
            user,
            pass,
        },
    });
    await transporter.sendMail({
        from: `"TBhon" <${from}>`,
        to,
        subject: "Your TBhon verification code",
        text: `Your TBhon verification code is ${code}. This code expires in 10 minutes.`,
        html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111111;">
        <h2>Verify your TBhon account</h2>
        <p>Your verification code is:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">${code}</p>
        <p>This code expires in 10 minutes.</p>
      </div>
    `,
    });
}
/** User-facing message when SMTP send fails (for API responses). */
function getEmailDeliveryErrorMessage(error) {
    if (error instanceof Error) {
        if (error.message.includes("SMTP credentials are not configured")) {
            return "Email is not configured on the server. Add EMAIL_USER and EMAIL_APP_PASSWORD to the backend .env file, then restart the server.";
        }
        if (/invalid login|authentication|535|EAUTH|username and password not accepted/i.test(error.message)) {
            return "Email login failed. Check your Gmail app password in the backend .env file.";
        }
    }
    return "Could not send verification email. Check SMTP settings and try again.";
}
//# sourceMappingURL=email.js.map