import { Router } from "express";
import {
  assignUserFacility,
  createFacility,
  listFacilities,
  updateFacility,
} from "../controllers/facility.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/requireAdmin.middleware";

export const adminRouter = Router();

const adminOnly = [requireAuth, requireAdmin] as const;

adminRouter.get("/facilities", ...adminOnly, listFacilities);
adminRouter.post("/facilities", ...adminOnly, createFacility);
adminRouter.patch("/facilities/:facilityId", ...adminOnly, updateFacility);
adminRouter.patch("/users/:userId/facility", ...adminOnly, assignUserFacility);
