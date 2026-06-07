import type { NextFunction, Response } from "express";
import { canRunScreenings, parseUserRole } from "../constants/userRole";
import type { AuthRequest } from "../types/auth";
import { HttpError } from "../utils/http";

/** Restrict routes to booth staff / facility admins (not future patient accounts). */
export function requireStaff(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!req.user?.userId) {
    return next(new HttpError(401, "Authentication is required"));
  }

  const role = parseUserRole(req.user.role);
  if (!canRunScreenings(role)) {
    return next(new HttpError(403, "Staff access is required to run screenings."));
  }

  return next();
}
