import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import {
  iotAcknowledgeSetupCheck,
  iotDebugRecentUploads,
  iotDeviceCommand,
  iotGetSetupCheck,
  iotGetDeviceCommand,
  iotGetDeviceStatus,
  iotGetTrigger,
  iotReportPresence,
  iotDownloadSputum,
  iotHealth,
  iotHello,
  iotStartSetupCheck,
  iotSetTrigger,
  iotUploadCough,
  iotUploadSputum,
} from "../controllers/iot.controller";
import { requireIotKey } from "../middleware/iot.middleware";
import { uploadSingle } from "../utils/upload";

export const iotRouter = Router();

function logIotHelloAttempt(req: Request, _res: Response, next: NextFunction) {
  const authSource = req.header("x-iot-key") ? "X-IoT-Key" : req.header("authorization") ? "Authorization" : "no key";
  console.log(`[iot] hello attempt from ${req.ip} (${authSource})`);
  next();
}

// Public health check — used by ESP32 firmware to confirm the URL/network.
iotRouter.get("/health", iotHealth);

// Debug endpoint to see recent uploads and pending commands (requires IoT key).
iotRouter.get("/debug/recent-uploads", requireIotKey, iotDebugRecentUploads);

// Authenticated smoke test for microcontrollers before sending real media.
iotRouter.post("/hello", logIotHelloAttempt, requireIotKey, iotHello);

// Poll/set capture trigger command for camera/audio devices.
iotRouter.post("/trigger", requireIotKey, iotSetTrigger);
iotRouter.get("/trigger", requireIotKey, iotGetTrigger);
iotRouter.post("/device-command", requireIotKey, iotDeviceCommand);
iotRouter.get("/device-command", requireIotKey, iotGetDeviceCommand);
iotRouter.post("/presence", requireIotKey, iotReportPresence);
iotRouter.get("/device-status", requireIotKey, iotGetDeviceStatus);
iotRouter.post("/setup-check", requireIotKey, iotStartSetupCheck);
iotRouter.post("/setup-check/ack", requireIotKey, iotAcknowledgeSetupCheck);
iotRouter.get("/setup-check/:checkId", requireIotKey, iotGetSetupCheck);

// All upload endpoints require the shared device key.
iotRouter.post(
  "/cough-recordings",
  requireIotKey,
  uploadSingle("file"),
  iotUploadCough,
);
iotRouter.post(
  "/sputum-images",
  requireIotKey,
  uploadSingle("file"),
  iotUploadSputum,
);
iotRouter.get(
  "/sputum-images/:sessionId/file",
  requireIotKey,
  iotDownloadSputum,
);
