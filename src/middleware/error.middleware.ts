import type { ErrorRequestHandler } from "express";
import multer from "multer";
import { Prisma } from "@prisma/client";
import { HttpError } from "../utils/http";
import { isUploadClientDisconnect } from "../utils/upload";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }

  if (error instanceof multer.MulterError) {
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    res.status(status).json({ message: error.message });
    return;
  }

  if (isUploadClientDisconnect(error)) {
    console.warn("[upload] Client disconnected before upload finished");
    if (!res.headersSent) {
      res.status(408).json({ message: "Upload interrupted" });
    }
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
