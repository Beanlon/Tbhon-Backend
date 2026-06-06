import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { HttpError } from "../utils/http";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021" || error.code === "P2022") {
      console.error("[db] Schema out of date:", error.message);
      res.status(503).json({
        message:
          "Database schema is out of date on the server. Run: npx prisma migrate deploy",
      });
      return;
    }
  }

  console.error(error);
  res.status(500).json({ message: "Internal server error" });
};
