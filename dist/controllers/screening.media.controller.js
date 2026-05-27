"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachCoughRecordingRaw = attachCoughRecordingRaw;
exports.attachSputumImageRaw = attachSputumImageRaw;
exports.uploadCoughRecording = uploadCoughRecording;
exports.uploadSputumImage = uploadSputumImage;
exports.downloadCoughRecording = downloadCoughRecording;
exports.downloadSputumImage = downloadSputumImage;
const crypto_1 = require("crypto");
const prisma_1 = require("../prisma");
const auth_middleware_1 = require("../middleware/auth.middleware");
const http_1 = require("../utils/http");
const upload_1 = require("../utils/upload");
async function findOwnedSession(sessionId, userId) {
    const session = await prisma_1.prisma.screeningSession.findFirst({
        where: { sessionId, userId },
        select: { sessionId: true },
    });
    if (!session)
        throw new http_1.HttpError(404, "Screening session not found");
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
async function attachCoughRecordingRaw(req, res) {
    const userId = (0, auth_middleware_1.getAuthenticatedUserId)(req);
    const sessionId = (0, http_1.getString)(req.params.sessionId);
    const recordingId = (0, http_1.getString)(req.params.recordingId);
    if (!sessionId || !recordingId)
        throw new http_1.HttpError(400, "sessionId and recordingId are required");
    await findOwnedSession(sessionId, userId);
    const existing = await prisma_1.prisma.coughRecording.findFirst({
        where: { recordingId, sessionId },
        select: { recordingId: true },
    });
    if (!existing)
        throw new http_1.HttpError(404, "Cough recording not found in this session");
    const uploaded = (0, upload_1.readUploadedFile)(req);
    if (!uploaded) {
        throw new http_1.HttpError(400, "Missing audio file. Send multipart field `file` or JSON `fileBase64`.");
    }
    const { buffer, mimeType, filename } = uploaded;
    const norm = (0, upload_1.normalizeAudioMime)(mimeType, filename);
    await prisma_1.prisma.coughRecording.update({
        where: { recordingId },
        data: {
            mimeType: norm.mimeType,
            rawData: (0, upload_1.toBytes)(buffer),
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
async function attachSputumImageRaw(req, res) {
    const userId = (0, auth_middleware_1.getAuthenticatedUserId)(req);
    const sessionId = (0, http_1.getString)(req.params.sessionId);
    if (!sessionId)
        throw new http_1.HttpError(400, "sessionId is required");
    await findOwnedSession(sessionId, userId);
    const uploaded = (0, upload_1.readUploadedFile)(req);
    if (!uploaded) {
        throw new http_1.HttpError(400, "Missing image file. Send multipart field `file` or JSON `fileBase64`.");
    }
    const { buffer, mimeType, filename } = uploaded;
    const norm = (0, upload_1.normalizeImageMime)(mimeType, filename);
    const existing = await prisma_1.prisma.sputumImage.findUnique({
        where: { sessionId },
        select: { imageId: true },
    });
    let imageId;
    if (existing) {
        imageId = existing.imageId;
        await prisma_1.prisma.sputumImage.update({
            where: { sessionId },
            data: {
                mimeType: norm.mimeType,
                rawData: (0, upload_1.toBytes)(buffer),
                byteSize: buffer.length,
            },
        });
    }
    else {
        imageId = (0, crypto_1.randomUUID)();
        await prisma_1.prisma.sputumImage.create({
            data: {
                imageId,
                sessionId,
                fileUri: null,
                mimeType: norm.mimeType,
                rawData: (0, upload_1.toBytes)(buffer),
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
async function uploadCoughRecording(req, res) {
    const userId = (0, auth_middleware_1.getAuthenticatedUserId)(req);
    const sessionId = (0, http_1.getString)(req.params.sessionId);
    if (!sessionId)
        throw new http_1.HttpError(400, "sessionId is required");
    await findOwnedSession(sessionId, userId);
    const uploaded = (0, upload_1.readUploadedFile)(req);
    if (!uploaded) {
        throw new http_1.HttpError(400, "Missing audio file. Send multipart field `file` or JSON `fileBase64`.");
    }
    const { buffer, mimeType, filename } = uploaded;
    const norm = (0, upload_1.normalizeAudioMime)(mimeType, filename);
    const recordingId = (0, crypto_1.randomUUID)();
    await prisma_1.prisma.coughRecording.create({
        data: {
            recordingId,
            sessionId,
            fileUri: null,
            mimeType: norm.mimeType,
            rawData: (0, upload_1.toBytes)(buffer),
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
async function uploadSputumImage(req, res) {
    const userId = (0, auth_middleware_1.getAuthenticatedUserId)(req);
    const sessionId = (0, http_1.getString)(req.params.sessionId);
    if (!sessionId)
        throw new http_1.HttpError(400, "sessionId is required");
    await findOwnedSession(sessionId, userId);
    const uploaded = (0, upload_1.readUploadedFile)(req);
    if (!uploaded) {
        throw new http_1.HttpError(400, "Missing image file. Send multipart field `file` or JSON `fileBase64`.");
    }
    const { buffer, mimeType, filename } = uploaded;
    const norm = (0, upload_1.normalizeImageMime)(mimeType, filename);
    // sputum_images has a unique constraint on session_id — upsert to overwrite
    // any previous image for this session (e.g. the user retook the photo).
    const imageId = (0, crypto_1.randomUUID)();
    const existing = await prisma_1.prisma.sputumImage.findUnique({
        where: { sessionId },
        select: { imageId: true },
    });
    if (existing) {
        await prisma_1.prisma.sputumImage.update({
            where: { sessionId },
            data: {
                fileUri: null,
                mimeType: norm.mimeType,
                rawData: (0, upload_1.toBytes)(buffer),
                byteSize: buffer.length,
                source: "mobile",
            },
        });
    }
    else {
        await prisma_1.prisma.sputumImage.create({
            data: {
                imageId,
                sessionId,
                fileUri: null,
                mimeType: norm.mimeType,
                rawData: (0, upload_1.toBytes)(buffer),
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
async function downloadCoughRecording(req, res) {
    const userId = (0, auth_middleware_1.getAuthenticatedUserId)(req);
    const sessionId = (0, http_1.getString)(req.params.sessionId);
    const recordingId = (0, http_1.getString)(req.params.recordingId);
    if (!sessionId || !recordingId)
        throw new http_1.HttpError(400, "sessionId and recordingId are required");
    await findOwnedSession(sessionId, userId);
    const row = await prisma_1.prisma.coughRecording.findFirst({
        where: { recordingId, sessionId },
        select: { rawData: true, mimeType: true, byteSize: true },
    });
    if (!row || !row.rawData) {
        throw new http_1.HttpError(404, "Cough recording bytes are not stored for this session");
    }
    const buf = Buffer.isBuffer(row.rawData) ? row.rawData : Buffer.from(row.rawData);
    res.setHeader("Content-Type", row.mimeType || "application/octet-stream");
    res.setHeader("Content-Length", String(buf.length));
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.status(200).end(buf);
}
/** GET /screenings/:sessionId/sputum-image/file */
async function downloadSputumImage(req, res) {
    const userId = (0, auth_middleware_1.getAuthenticatedUserId)(req);
    const sessionId = (0, http_1.getString)(req.params.sessionId);
    if (!sessionId)
        throw new http_1.HttpError(400, "sessionId is required");
    await findOwnedSession(sessionId, userId);
    const row = await prisma_1.prisma.sputumImage.findUnique({
        where: { sessionId },
        select: { rawData: true, mimeType: true, byteSize: true },
    });
    if (!row || !row.rawData) {
        throw new http_1.HttpError(404, "Sputum image bytes are not stored for this session");
    }
    const buf = Buffer.isBuffer(row.rawData) ? row.rawData : Buffer.from(row.rawData);
    res.setHeader("Content-Type", row.mimeType || "application/octet-stream");
    res.setHeader("Content-Length", String(buf.length));
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.status(200).end(buf);
}
//# sourceMappingURL=screening.media.controller.js.map