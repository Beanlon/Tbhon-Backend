import type { NextFunction, Response } from "express";
import { parseUserRole } from "../constants/userRole";
import type { AuthRequest } from "../types/auth";
import { HttpError } from "../utils/http";

/** Program / system admin — manages facilities and staff onboarding. */
export function requireAdmin(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!req.user?.userId) {
    return next(new HttpError(401, "Authentication is required"));
  }

  const role = parseUserRole(req.user.role);
  if (role !== "ADMIN") {
    return next(new HttpError(403, "Admin access is required."));
  }

  return next();
}
