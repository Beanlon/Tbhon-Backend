import type { NextFunction, Response } from "express";
import { prisma } from "../prisma";
import type { AuthRequest } from "../types/auth";
import { HttpError } from "../utils/http";
/** Gates value-add features (export history, share payloads) — not core screening. */
export async function requireEmailVerified(req: AuthRequest, _res: Response, next: NextFunction) {
  const userId = req.user?.userId;
  if (!userId) {
    return next(new HttpError(401, "Authorization token is required"));
  }

  const user = await prisma.user.findUnique({
    where: { userId },
    select: { emailVerified: true },
  });

  if (!user) {
    return next(new HttpError(404, "User not found"));
  }

  if (!user.emailVerified) {
    return next(
      new HttpError(
        403,
        "Verify your email in Profile to use this feature. Check your inbox or request a new code.",
      ),
    );
  }

  return next();
}
