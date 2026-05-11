import { Router } from "express";
import { completeScreening, getMyScreening, listMyScreenings } from "../controllers/screening.controller";
import { requireAuth } from "../middleware/auth.middleware";

export const screeningRouter = Router();

screeningRouter.post("/", requireAuth, completeScreening);
screeningRouter.get("/", requireAuth, listMyScreenings);
screeningRouter.get("/:sessionId", requireAuth, getMyScreening);
