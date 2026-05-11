export declare class HttpError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string);
}
export declare function isRecord(value: unknown): value is Record<string, unknown>;
export declare function getString(value: unknown): string | undefined;
//# sourceMappingURL=http.d.ts.map