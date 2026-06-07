import type { Response } from "express";
import { parseUserRole } from "../constants/userRole";
import { prisma } from "../prisma";
import type { AuthRequest } from "../types/auth";
import {
  findActiveFacilityByInviteCode,
  toFacilitySummary,
} from "../services/facility.service";
import {
  facilityInviteCodeValidationError,
  generateFacilityInviteCode,
  normalizeFacilityInviteCode,
} from "../utils/facilityInvite";
import { HttpError, getString, isRecord } from "../utils/http";
import { toUserResponse } from "../utils/userResponse";

export async function validateFacilityInvite(req: AuthRequest, res: Response) {
  if (!isRecord(req.body)) {
    throw new HttpError(400, "Request body is required");
  }

  const rawCode = getString(req.body.inviteCode) ?? getString(req.body.facilityInviteCode);
  const formatError = facilityInviteCodeValidationError(rawCode ?? "");
  if (formatError) {
    throw new HttpError(400, formatError);
  }

  const facility = await findActiveFacilityByInviteCode(rawCode!);
  if (!facility) {
    throw new HttpError(404, "Invalid or inactive facility invite code.");
  }

  res.json({
    ok: true,
    facility: toFacilitySummary(facility),
  });
}

export async function createFacility(req: AuthRequest, res: Response) {
  if (!isRecord(req.body)) {
    throw new HttpError(400, "Request body is required");
  }

  const name = getString(req.body.name)?.trim();
  if (!name) {
    throw new HttpError(400, "name is required");
  }

  const rawCode = getString(req.body.inviteCode);
  const inviteCode = rawCode
    ? normalizeFacilityInviteCode(rawCode)
    : generateFacilityInviteCode();

  const formatError = facilityInviteCodeValidationError(inviteCode);
  if (formatError) {
    throw new HttpError(400, formatError);
  }

  const city = getString(req.body.city)?.trim() || null;
  const barangay = getString(req.body.barangay)?.trim() || null;

  const existing = await prisma.facility.findUnique({ where: { inviteCode } });
  if (existing) {
    throw new HttpError(409, "That invite code is already in use.");
  }

  const facility = await prisma.facility.create({
    data: {
      name,
      inviteCode,
      city,
      barangay,
    },
  });

  res.status(201).json({
    facility: {
      ...toFacilitySummary(facility),
      inviteCode: facility.inviteCode,
      isActive: facility.isActive,
    },
  });
}

export async function listFacilities(_req: AuthRequest, res: Response) {
  const facilities = await prisma.facility.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      facilityId: true,
      name: true,
      inviteCode: true,
      city: true,
      barangay: true,
      isActive: true,
      createdAt: true,
      _count: { select: { staff: true } },
    },
  });

  res.json({
    facilities: facilities.map((f) => ({
      facilityId: f.facilityId,
      name: f.name,
      inviteCode: f.inviteCode,
      city: f.city,
      barangay: f.barangay,
      isActive: f.isActive,
      staffCount: f._count.staff,
      createdAt: f.createdAt,
    })),
  });
}

export async function updateFacility(req: AuthRequest, res: Response) {
  const facilityId = getString(req.params.facilityId);
  if (!facilityId) {
    throw new HttpError(400, "facilityId is required");
  }

  if (!isRecord(req.body)) {
    throw new HttpError(400, "Request body is required");
  }

  const existing = await prisma.facility.findUnique({ where: { facilityId } });
  if (!existing) {
    throw new HttpError(404, "Facility not found");
  }

  const name = getString(req.body.name)?.trim();
  const city = getString(req.body.city)?.trim();
  const barangay = getString(req.body.barangay)?.trim();
  const isActive =
    req.body.isActive === undefined ? undefined : Boolean(req.body.isActive);

  const facility = await prisma.facility.update({
    where: { facilityId },
    data: {
      ...(name ? { name } : {}),
      ...(city !== undefined ? { city: city || null } : {}),
      ...(barangay !== undefined ? { barangay: barangay || null } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
  });

  res.json({
    facility: {
      ...toFacilitySummary(facility),
      inviteCode: facility.inviteCode,
      isActive: facility.isActive,
    },
  });
}

/** Assign an existing user to a facility (legacy accounts without invite signup). */
export async function assignUserFacility(req: AuthRequest, res: Response) {
  const userId = getString(req.params.userId);
  if (!userId) {
    throw new HttpError(400, "userId is required");
  }

  if (!isRecord(req.body)) {
    throw new HttpError(400, "Request body is required");
  }

  const facilityId = getString(req.body.facilityId);
  if (!facilityId) {
    throw new HttpError(400, "facilityId is required");
  }

  const facility = await prisma.facility.findUnique({ where: { facilityId } });
  if (!facility) {
    throw new HttpError(404, "Facility not found");
  }

  const user = await prisma.user.findUnique({ where: { userId } });
  if (!user) {
    throw new HttpError(404, "User not found");
  }

  if (parseUserRole(user.role) === "ADMIN") {
    throw new HttpError(400, "Admin accounts are not tied to a facility.");
  }

  const updated = await prisma.user.update({
    where: { userId },
    data: { facilityId },
    include: {
      profile: true,
      facility: {
        select: {
          facilityId: true,
          name: true,
          city: true,
          barangay: true,
        },
      },
    },
  });

  res.json({ user: toUserResponse(updated) });
}
