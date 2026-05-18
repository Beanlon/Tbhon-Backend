type VerificationEmailArgs = {
    to: string;
    code: string;
};
export declare function sendVerificationEmail({ to, code }: VerificationEmailArgs): Promise<void>;
/** User-facing message when SMTP send fails (for API responses). */
export declare function getEmailDeliveryErrorMessage(error: unknown): string;
export {};
//# sourceMappingURL=email.d.ts.map