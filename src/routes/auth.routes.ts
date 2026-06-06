import { Router } from "express";
import { login, logout, refreshSession, register } from "../controllers/auth.controller";
import { sendEmailVerification, verifyEmail } from "../controllers/emailVerification.controller";
import {
  confirmChangePassword,
  forgotPassword,
  resetPassword,
  sendChangePasswordCode,
} from "../controllers/passwordReset.controller";
import { requireAuth } from "../middleware/auth.middleware";

export const authRouter = Router();

authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.post("/refresh", refreshSession);
authRouter.post("/logout", logout);
authRouter.post("/email/send-verification", requireAuth, sendEmailVerification);
authRouter.post("/email/verify", requireAuth, verifyEmail);
authRouter.post("/forgot-password", forgotPassword);
authRouter.post("/reset-password", resetPassword);
authRouter.post("/change-password/send-code", requireAuth, sendChangePasswordCode);
authRouter.post("/change-password/confirm", requireAuth, confirmChangePassword);
