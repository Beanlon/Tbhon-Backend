export type AuthTokenPayload = {
    userId: string;
    email: string | null;
};
export declare function signAuthToken(payload: AuthTokenPayload): string;
export declare function verifyAuthToken(token: string): AuthTokenPayload;
//# sourceMappingURL=jwt.d.ts.map