import type { Response } from "express";
import type { AuthRequest } from "../types/auth";
/**
 * POST /screenings/:sessionId/cough-recordings/:recordingId/raw
 *
 * Attach raw audio bytes onto an existing cough_recording row (one that was
 * created by `completeScreening`). This lets the mobile app upload the
 * device-local file straight after finishing a screening so other phones on
 * the same account can later download/play the original audio.
 */
export declare function attachCoughRecordingRaw(req: AuthRequest, res: Response): Promise<void>;
/**
 * POST /screenings/:sessionId/sputum-image/raw
 *
 * Attach raw image bytes onto the sputum_image row for this session
 * (one row per session). Creates the row if `completeScreening` skipped it
 * (e.g. the user retook the photo after persisting the session).
 */
export declare function attachSputumImageRaw(req: AuthRequest, res: Response): Promise<void>;
/** POST /screenings/:sessionId/cough-recordings — multipart file=  */
export declare function uploadCoughRecording(req: AuthRequest, res: Response): Promise<void>;
/** POST /screenings/:sessionId/sputum-image — multipart file=  */
export declare function uploadSputumImage(req: AuthRequest, res: Response): Promise<void>;
/** GET /screenings/:sessionId/cough-recordings/:recordingId/file */
export declare function downloadCoughRecording(req: AuthRequest, res: Response): Promise<void>;
/** GET /screenings/:sessionId/sputum-image/file */
export declare function downloadSputumImage(req: AuthRequest, res: Response): Promise<void>;
//# sourceMappingURL=screening.media.controller.d.ts.map