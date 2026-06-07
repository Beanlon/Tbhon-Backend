import type { NextFunction, Response } from "express";
import { HttpError } from "../utils/http";
import { verifyAuthToken } from "../utils/auth";
import type { AuthRequest } from "../types/auth";

/** Read userId set by `requireAuth`; use in controllers after the middleware. */
export function getAuthenticatedUserId(req: AuthRequest): string {
  const userId = req.user?.userId;
  if (!userId) {
    throw new HttpError(401, "Authorization token is required");
  }
  return userId;
}

export function requireAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : undefined;

  if (!token) {
    return next(new HttpError(401, "Authorization token is required"));
  }

  try {
    const payload = verifyAuthToken(token);
    req.user = { userId: payload.userId, role: payload.role };
    return next();
  } catch {
    return next(new HttpError(401, "Invalid or expired token"));
  }
}
