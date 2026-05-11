import { Router } from "express";
import { getMe, updateMe, upsertMyProfile } from "../controllers/user.controller";
import { requireAuth } from "../middleware/auth.middleware";

export const userRouter = Router();

userRouter.get("/me", requireAuth, getMe);
userRouter.patch("/me", requireAuth, updateMe);
userRouter.put("/me/profile", requireAuth, upsertMyProfile);
