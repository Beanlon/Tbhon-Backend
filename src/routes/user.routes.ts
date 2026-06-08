import { Router } from "express";
import { ensureMyPatientCode, getMe, updateMe, upsertMyProfile } from "../controllers/user.controller";
import { requireAuth } from "../middleware/auth.middleware";

export const userRouter = Router();

userRouter.get("/me", requireAuth, getMe);
userRouter.post("/me/patient-code", requireAuth, ensureMyPatientCode);
userRouter.patch("/me", requireAuth, updateMe);
userRouter.put("/me/profile", requireAuth, upsertMyProfile);
