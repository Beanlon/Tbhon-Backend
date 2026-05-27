import { Router } from "express";
import {
  completeScreening,
  createDraftScreening,
  getMyScreening,
  listMyScreenings,
  requestIotCapture,
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
import { upload } from "../utils/upload";

export const screeningRouter = Router();

screeningRouter.post("/", requireAuth, completeScreening);
screeningRouter.post("/draft", requireAuth, createDraftScreening);
screeningRouter.post("/iot/request-capture", requireAuth, requestIotCapture);
screeningRouter.get("/", requireAuth, listMyScreenings);
screeningRouter.get("/:sessionId", requireAuth, getMyScreening);

// --- Raw media (account-scoped, cross-device) -----------------------------
// Attach raw audio bytes onto a cough_recording row that `completeScreening`
// already created. This is the path the mobile app uses right after finishing
// a screening so any signed-in device can later play the original audio.
screeningRouter.post(
  "/:sessionId/cough-recordings/:recordingId/raw",
  requireAuth,
  upload.single("file"),
  attachCoughRecordingRaw,
);
// Attach raw sputum/phlegm bytes onto the sputum_image row.
screeningRouter.post(
  "/:sessionId/sputum-image/raw",
  requireAuth,
  upload.single("file"),
  attachSputumImageRaw,
);

// Standalone create endpoints (used when uploading media outside the normal
// completeScreening flow, e.g. retroactively backfilling or from companion
// apps). They never delete existing rows.
screeningRouter.post(
  "/:sessionId/cough-recordings",
  requireAuth,
  upload.single("file"),
  uploadCoughRecording,
);
screeningRouter.post(
  "/:sessionId/sputum-image",
  requireAuth,
  upload.single("file"),
  uploadSputumImage,
);

// Streaming download endpoints. Mobile clients send the user's auth bearer
// and stream Content-Type-tagged bytes into <Image source={{uri, headers}}>
// or Expo AV.
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
