import type { Response } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../prisma";
import type { AuthRequest } from "../types/auth";
import { getAuthenticatedUserId } from "../middleware/auth.middleware";
import { HttpError, getString } from "../utils/http";
import { normalizeAudioMime, normalizeImageMime, readUploadedFile, toBytes } from "../utils/upload";

async function findOwnedSession(sessionId: string, userId: string) {
  const session = await prisma.screeningSession.findFirst({
    where: { sessionId, userId },
    select: { sessionId: true },
  });
  if (!session) throw new HttpError(404, "Screening session not found");
  return session;
}

/**
 * POST /screenings/:sessionId/cough-recordings/:recordingId/raw
 *
 * Attach raw audio bytes onto an existing cough_recording row (one that was
 * created by `completeScreening`). This lets the mobile app upload the
 * device-local file straight after finishing a screening so other phones on
 * the same account can later download/play the original audio.
 */
export async function attachCoughRecordingRaw(req: AuthRequest, res: Response) {
  const userId = getAuthenticatedUserId(req);
  const sessionId = getString(req.params.sessionId);
  const recordingId = getString(req.params.recordingId);
  if (!sessionId || !recordingId) throw new HttpError(400, "sessionId and recordingId are required");

  await findOwnedSession(sessionId, userId);

  const existing = await prisma.coughRecording.findFirst({
    where: { recordingId, sessionId },
    select: { recordingId: true },
  });
  if (!existing) throw new HttpError(404, "Cough recording not found in this session");

  const uploaded = readUploadedFile(req);
  if (!uploaded) {
    throw new HttpError(400, "Missing audio file. Send multipart field `file` or JSON `fileBase64`.");
  }
  const { buffer, mimeType, filename } = uploaded;
  const norm = normalizeAudioMime(mimeType, filename);

  await prisma.coughRecording.update({
    where: { recordingId },
    data: {
      mimeType: norm.mimeType,
      rawData: toBytes(buffer),
      byteSize: buffer.length,
    },
  });

  res.status(200).json({
    recording: {
      recordingId,
      sessionId,
      mimeType: norm.mimeType,
      byteSize: buffer.length,
      fileUrl: `/screenings/${encodeURIComponent(sessionId)}/cough-recordings/${encodeURIComponent(recordingId)}/file`,
    },
  });
}

/**
 * POST /screenings/:sessionId/sputum-image/raw
 *
 * Attach raw image bytes onto the sputum_image row for this session
 * (one row per session). Creates the row if `completeScreening` skipped it
 * (e.g. the user retook the photo after persisting the session).
 */
export async function attachSputumImageRaw(req: AuthRequest, res: Response) {
  const userId = getAuthenticatedUserId(req);
  const sessionId = getString(req.params.sessionId);
  if (!sessionId) throw new HttpError(400, "sessionId is required");

  await findOwnedSession(sessionId, userId);

  const uploaded = readUploadedFile(req);
  if (!uploaded) {
    throw new HttpError(400, "Missing image file. Send multipart field `file` or JSON `fileBase64`.");
  }
  const { buffer, mimeType, filename } = uploaded;
  const norm = normalizeImageMime(mimeType, filename);

  const existing = await prisma.sputumImage.findUnique({
    where: { sessionId },
    select: { imageId: true },
  });

  let imageId: string;
  if (existing) {
    imageId = existing.imageId;
    await prisma.sputumImage.update({
      where: { sessionId },
      data: {
        mimeType: norm.mimeType,
        rawData: toBytes(buffer),
        byteSize: buffer.length,
      },
    });
  } else {
    imageId = randomUUID();
    await prisma.sputumImage.create({
      data: {
        imageId,
        sessionId,
        fileUri: null,
        mimeType: norm.mimeType,
        rawData: toBytes(buffer),
        byteSize: buffer.length,
        source: "mobile",
      },
    });
  }

  res.status(200).json({
    image: {
      imageId,
      sessionId,
      mimeType: norm.mimeType,
      byteSize: buffer.length,
      fileUrl: `/screenings/${encodeURIComponent(sessionId)}/sputum-image/file`,
    },
  });
}

/** POST /screenings/:sessionId/cough-recordings — multipart file=  */
export async function uploadCoughRecording(req: AuthRequest, res: Response) {
  const userId = getAuthenticatedUserId(req);
  const sessionId = getString(req.params.sessionId);
  if (!sessionId) throw new HttpError(400, "sessionId is required");

  await findOwnedSession(sessionId, userId);

  const uploaded = readUploadedFile(req);
  if (!uploaded) {
    throw new HttpError(400, "Missing audio file. Send multipart field `file` or JSON `fileBase64`.");
  }
  const { buffer, mimeType, filename } = uploaded;
  const norm = normalizeAudioMime(mimeType, filename);

  const recordingId = randomUUID();
  await prisma.coughRecording.create({
    data: {
      recordingId,
      sessionId,
      fileUri: null,
      mimeType: norm.mimeType,
      rawData: toBytes(buffer),
      byteSize: buffer.length,
      source: "mobile",
    },
  });

  res.status(201).json({
    recording: {
      recordingId,
      sessionId,
      mimeType: norm.mimeType,
      byteSize: buffer.length,
      fileUrl: `/screenings/${encodeURIComponent(sessionId)}/cough-recordings/${encodeURIComponent(recordingId)}/file`,
    },
  });
}

/** POST /screenings/:sessionId/sputum-image — multipart file=  */
export async function uploadSputumImage(req: AuthRequest, res: Response) {
  const userId = getAuthenticatedUserId(req);
  const sessionId = getString(req.params.sessionId);
  if (!sessionId) throw new HttpError(400, "sessionId is required");

  await findOwnedSession(sessionId, userId);

  const uploaded = readUploadedFile(req);
  if (!uploaded) {
    throw new HttpError(400, "Missing image file. Send multipart field `file` or JSON `fileBase64`.");
  }
  const { buffer, mimeType, filename } = uploaded;
  const norm = normalizeImageMime(mimeType, filename);

  // sputum_images has a unique constraint on session_id — upsert to overwrite
  // any previous image for this session (e.g. the user retook the photo).
  const imageId = randomUUID();
  const existing = await prisma.sputumImage.findUnique({
    where: { sessionId },
    select: { imageId: true },
  });

  if (existing) {
    await prisma.sputumImage.update({
      where: { sessionId },
      data: {
        fileUri: null,
        mimeType: norm.mimeType,
        rawData: toBytes(buffer),
        byteSize: buffer.length,
        source: "mobile",
      },
    });
  } else {
    await prisma.sputumImage.create({
      data: {
        imageId,
        sessionId,
        fileUri: null,
        mimeType: norm.mimeType,
        rawData: toBytes(buffer),
        byteSize: buffer.length,
        source: "mobile",
      },
    });
  }

  res.status(201).json({
    image: {
      imageId: existing?.imageId ?? imageId,
      sessionId,
      mimeType: norm.mimeType,
      byteSize: buffer.length,
      fileUrl: `/screenings/${encodeURIComponent(sessionId)}/sputum-image/file`,
    },
  });
}

/** GET /screenings/:sessionId/cough-recordings/:recordingId/file */
export async function downloadCoughRecording(req: AuthRequest, res: Response) {
  const userId = getAuthenticatedUserId(req);
  const sessionId = getString(req.params.sessionId);
  const recordingId = getString(req.params.recordingId);
  if (!sessionId || !recordingId) throw new HttpError(400, "sessionId and recordingId are required");

  await findOwnedSession(sessionId, userId);

  const row = await prisma.coughRecording.findFirst({
    where: { recordingId, sessionId },
    select: { rawData: true, mimeType: true, byteSize: true },
  });

  if (!row || !row.rawData) {
    throw new HttpError(404, "Cough recording bytes are not stored for this session");
  }

  const buf = Buffer.isBuffer(row.rawData) ? row.rawData : Buffer.from(row.rawData);
  res.setHeader("Content-Type", row.mimeType || "application/octet-stream");
  res.setHeader("Content-Length", String(buf.length));
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.status(200).end(buf);
}

/** GET /screenings/:sessionId/sputum-image/file */
export async function downloadSputumImage(req: AuthRequest, res: Response) {
  const userId = getAuthenticatedUserId(req);
  const sessionId = getString(req.params.sessionId);
  if (!sessionId) throw new HttpError(400, "sessionId is required");

  await findOwnedSession(sessionId, userId);

  const row = await prisma.sputumImage.findUnique({
    where: { sessionId },
    select: { rawData: true, mimeType: true, byteSize: true },
  });

  if (!row || !row.rawData) {
    throw new HttpError(404, "Sputum image bytes are not stored for this session");
  }

  const buf = Buffer.isBuffer(row.rawData) ? row.rawData : Buffer.from(row.rawData);
  res.setHeader("Content-Type", row.mimeType || "application/octet-stream");
  res.setHeader("Content-Length", String(buf.length));
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.status(200).end(buf);
}
