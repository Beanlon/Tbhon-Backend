import type { Request } from "express";

export type AuthUser = {
  userId: string;
};

export type AuthRequest = Request & {
  user?: AuthUser;
};
