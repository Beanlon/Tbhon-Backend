import type { NextFunction, Response } from "express";
import { canRunScreenings, parseUserRole } from "../constants/userRole";
import { prisma } from "../prisma";
import type { AuthRequest } from "../types/auth";
import { HttpError } from "../utils/http";

/** Restrict routes to booth staff / facility admins (not future patient accounts). */
export async function requireStaff(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!req.user?.userId) {
    return next(new HttpError(401, "Authentication is required"));
  }

  const role = parseUserRole(req.user.role);
  if (!canRunScreenings(role)) {
    return next(new HttpError(403, "Staff access is required to run screenings."));
  }

  if (role === "STAFF") {
    const user = await prisma.user.findUnique({
      where: { userId: req.user.userId },
      select: {
        facilityId: true,
        facility: { select: { isActive: true } },
      },
    });

    if (!user?.facilityId || !user.facility?.isActive) {
      return next(
        new HttpError(
          403,
          "A valid facility invite is required to run screenings. Register with your RHU invite code or contact your program admin.",
        ),
      );
    }
  }

  return next();
}
