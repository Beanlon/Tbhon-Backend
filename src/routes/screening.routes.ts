import { Router } from "express";
import {
  cleanupIncompleteScreenings,
  completeScreening,
  createDraftScreening,
  deleteIncompleteScreening,
  exportMyScreenings,
  getIotDeviceStatus,
  getMyScreening,
  listMyScreenings,
  requestIotCapture,
  updateScreeningReferral,
  upsertScreeningClient,
} from "../controllers/screening.controller";
import {
  attachCoughRecordingRaw,
  attachSputumImageRaw,
  downloadCoughRecording,
  downloadSputumImage,
  uploadCoughRecording,
  uploadSputumImage,
} from "../controllers/screening.media.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireEmailVerified } from "../middleware/requireEmailVerified.middleware";
import { requireStaff } from "../middleware/requireStaff.middleware";
import { upload } from "../utils/upload";

export const screeningRouter = Router();

const staffScreening = [requireAuth, requireStaff] as const;

screeningRouter.post("/", ...staffScreening, completeScreening);
screeningRouter.post("/draft", ...staffScreening, createDraftScreening);
screeningRouter.post("/iot/request-capture", ...staffScreening, requestIotCapture);
screeningRouter.get("/iot/device-status", ...staffScreening, getIotDeviceStatus);
screeningRouter.post("/cleanup-incomplete", ...staffScreening, cleanupIncompleteScreenings);
screeningRouter.get("/", requireAuth, listMyScreenings);
screeningRouter.get("/export", requireAuth, requireEmailVerified, exportMyScreenings);
screeningRouter.delete("/:sessionId", ...staffScreening, deleteIncompleteScreening);
screeningRouter.put("/:sessionId/client", ...staffScreening, upsertScreeningClient);
screeningRouter.patch("/:sessionId/referral", ...staffScreening, updateScreeningReferral);
screeningRouter.get("/:sessionId", requireAuth, getMyScreening);

// --- Raw media (account-scoped, cross-device) -----------------------------
screeningRouter.post(
  "/:sessionId/cough-recordings/:recordingId/raw",
  ...staffScreening,
  upload.single("file"),
  attachCoughRecordingRaw,
);
screeningRouter.post(
  "/:sessionId/sputum-image/raw",
  ...staffScreening,
  upload.single("file"),
  attachSputumImageRaw,
);

screeningRouter.post(
  "/:sessionId/cough-recordings",
  ...staffScreening,
  upload.single("file"),
  uploadCoughRecording,
);
screeningRouter.post(
  "/:sessionId/sputum-image",
  ...staffScreening,
  upload.single("file"),
  uploadSputumImage,
);

screeningRouter.get(
  "/:sessionId/cough-recordings/:recordingId/file",
  requireAuth,
  downloadCoughRecording,
);
screeningRouter.get(
  "/:sessionId/sputum-image/file",
  requireAuth,
  downloadSputumImage,
);
