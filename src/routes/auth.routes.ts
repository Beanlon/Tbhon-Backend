import { Router } from "express";
import { login, register } from "../controllers/auth.controller";
import { sendEmailVerification, verifyEmail } from "../controllers/emailVerification.controller";
import { requireAuth } from "../middleware/auth.middleware";

export const authRouter = Router();

authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.post("/email/send-verification", requireAuth, sendEmailVerification);
authRouter.post("/email/verify", requireAuth, verifyEmail);
