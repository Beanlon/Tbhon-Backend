import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../types/auth";
/** Read userId set by `requireAuth`; use in controllers after the middleware. */
export declare function getAuthenticatedUserId(req: AuthRequest): string;
export declare function requireAuth(req: AuthRequest, _res: Response, next: NextFunction): void;
//# sourceMappingURL=auth.middleware.d.ts.map