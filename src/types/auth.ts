import type { Request } from "express";
import type { UserRole } from "../constants/userRole";

export type AuthUser = {
  userId: string;
  role: UserRole;
};

export type AuthRequest = Request & {
  user?: AuthUser;
};
