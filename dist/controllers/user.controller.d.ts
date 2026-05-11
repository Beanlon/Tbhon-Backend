import type { Response } from "express";
import type { AuthRequest } from "../types/auth";
export declare function getMe(req: AuthRequest, res: Response): Promise<void>;
export declare function updateMe(req: AuthRequest, res: Response): Promise<void>;
export declare function upsertMyProfile(req: AuthRequest, res: Response): Promise<void>;
//# sourceMappingURL=user.controller.d.ts.map