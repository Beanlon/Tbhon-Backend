"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.screeningRouter = void 0;
const express_1 = require("express");
const screening_controller_1 = require("../controllers/screening.controller");
const screening_media_controller_1 = require("../controllers/screening.media.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const upload_1 = require("../utils/upload");
exports.screeningRouter = (0, express_1.Router)();
exports.screeningRouter.post("/", auth_middleware_1.requireAuth, screening_controller_1.completeScreening);
exports.screeningRouter.get("/", auth_middleware_1.requireAuth, screening_controller_1.listMyScreenings);
exports.screeningRouter.get("/:sessionId", auth_middleware_1.requireAuth, screening_controller_1.getMyScreening);
// --- Raw media (account-scoped, cross-device) -----------------------------
// Attach raw audio bytes onto a cough_recording row that `completeScreening`
// already created. This is the path the mobile app uses right after finishing
// a screening so any signed-in device can later play the original audio.
exports.screeningRouter.post("/:sessionId/cough-recordings/:recordingId/raw", auth_middleware_1.requireAuth, upload_1.upload.single("file"), screening_media_controller_1.attachCoughRecordingRaw);
// Attach raw sputum/phlegm bytes onto the sputum_image row.
exports.screeningRouter.post("/:sessionId/sputum-image/raw", auth_middleware_1.requireAuth, upload_1.upload.single("file"), screening_media_controller_1.attachSputumImageRaw);
// Standalone create endpoints (used when uploading media outside the normal
// completeScreening flow, e.g. retroactively backfilling or from companion
// apps). They never delete existing rows.
exports.screeningRouter.post("/:sessionId/cough-recordings", auth_middleware_1.requireAuth, upload_1.upload.single("file"), screening_media_controller_1.uploadCoughRecording);
exports.screeningRouter.post("/:sessionId/sputum-image", auth_middleware_1.requireAuth, upload_1.upload.single("file"), screening_media_controller_1.uploadSputumImage);
// Streaming download endpoints. Mobile clients send the user's auth bearer
// and stream Content-Type-tagged bytes into <Image source={{uri, headers}}>
// or Expo AV.
exports.screeningRouter.get("/:sessionId/cough-recordings/:recordingId/file", auth_middleware_1.requireAuth, screening_media_controller_1.downloadCoughRecording);
exports.screeningRouter.get("/:sessionId/sputum-image/file", auth_middleware_1.requireAuth, screening_media_controller_1.downloadSputumImage);
//# sourceMappingURL=screening.routes.js.map