export type JwtPayload = {
    userId: string;
};
export declare function signAuthToken(payload: JwtPayload): string;
export declare function verifyAuthToken(token: string): JwtPayload;
//# sourceMappingURL=auth.d.ts.map