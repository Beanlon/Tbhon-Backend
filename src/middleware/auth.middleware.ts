import type { NextFunction, Response } from "express";
import { HttpError } from "../utils/http";
import { verifyAuthToken } from "../utils/auth";
import type { AuthRequest } from "../types/auth";

export function requireAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    return next(new HttpError(401, "Authorization token is required"));
  }

  try {
    const payload = verifyAuthToken(token);
    req.user = { userId: payload.userId };
    return next();
  } catch {
    return next(new HttpError(401, "Invalid or expired token"));
  }
}
