"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.iotUploadCough = iotUploadCough;
exports.iotUploadSputum = iotUploadSputum;
exports.iotHealth = iotHealth;
exports.iotHello = iotHello;
exports.iotDeviceCommand = iotDeviceCommand;
exports.iotGetDeviceCommand = iotGetDeviceCommand;
exports.iotSetTrigger = iotSetTrigger;
exports.iotGetTrigger = iotGetTrigger;
exports.iotDownloadSputum = iotDownloadSputum;
const crypto_1 = require("crypto");
const prisma_1 = require("../prisma");
const http_1 = require("../utils/http");
const upload_1 = require("../utils/upload");
const AUDIO_MIN_SECONDS = 3;
const AUDIO_MAX_SECONDS = 10;
let pendingDeviceCommand = null;
let activeAudioCapture = null;
function bodyOf(req) {
    return (0, http_1.isRecord)(req.body) ? req.body : {};
}
function parseDeviceCommand(raw) {
    if (typeof raw !== "string")
        return null;
    const normalized = raw.trim().toLowerCase();
    if (normalized === "image")
        return "image";
    if (["audio", "audio start", "audio-start", "audio_start"].includes(normalized)) {
        return "audio";
    }
    if (["audio upload", "audio-upload", "audio_upload", "stop", "stop-audio", "stop_audio", "stopaudio"].includes(normalized)) {
        return "audio upload";
    }
    return null;
}
function getActiveAudioElapsedSeconds() {
    if (!activeAudioCapture)
        return null;
    return (Date.now() - activeAudioCapture.startedAtMs) / 1000;
}
function assertAudioUploadAllowed() {
    const elapsedSeconds = getActiveAudioElapsedSeconds();
    if (!activeAudioCapture || elapsedSeconds === null) {
        throw new http_1.HttpError(409, "No active audio recording to upload");
    }
    if (elapsedSeconds < AUDIO_MIN_SECONDS) {
        throw new http_1.HttpError(409, `Audio upload can only be requested after ${AUDIO_MIN_SECONDS} seconds`);
    }
}
function formatDeviceCommandForFirmware(command) {
    return command.command;
}
function getSingleValue(raw) {
    if (typeof raw === "string")
        return raw.trim();
    if (Array.isArray(raw) && typeof raw[0] === "string")
        return raw[0].trim();
    return undefined;
}
function getConsumeQueryValue(req) {
    const q = getSingleValue(req.query.consume);
    if (!q)
        return true;
    return !["0", "false", "no"].includes(q.toLowerCase());
}
function imageFilenameExt(mimeType) {
    if (!mimeType)
        return "bin";
    if (mimeType.includes("jpeg") || mimeType.includes("jpg"))
        return "jpg";
    if (mimeType.includes("png"))
        return "png";
    if (mimeType.includes("webp"))
        return "webp";
    return "bin";
}
async function resolveOrCreateSession(args) {
    const { userId, sessionId } = args;
    if (sessionId) {
        const existing = await prisma_1.prisma.screeningSession.findFirst({
            where: { sessionId, userId },
            select: { sessionId: true },
        });
        if (existing)
            return existing.sessionId;
    }
    const userExists = await prisma_1.prisma.user.findUnique({
        where: { userId },
        select: { userId: true },
    });
    if (!userExists) {
        throw new http_1.HttpError(404, "Unknown userId");
    }
    const newSessionId = sessionId ?? (0, crypto_1.randomUUID)();
    await prisma_1.prisma.screeningSession.create({
        data: {
            sessionId: newSessionId,
            userId,
            startedAt: new Date(),
            apiAttempt: "iot",
        },
    });
    return newSessionId;
}
/** POST /iot/cough-recordings */
async function iotUploadCough(req, res) {
    const body = bodyOf(req);
    const userId = (0, http_1.getString)(body.userId);
    if (!userId)
        throw new http_1.HttpError(400, "userId is required");
    const sessionId = (0, http_1.getString)(body.sessionId) ?? undefined;
    const deviceId = (0, http_1.getString)(body.deviceId) ?? null;
    const file = (0, upload_1.readUploadedFile)(req);
    if (!file) {
        throw new http_1.HttpError(400, "Missing audio. Send multipart `file` or JSON `fileBase64`.");
    }
    const norm = (0, upload_1.normalizeAudioMime)(file.mimeType, file.filename);
    const resolvedSessionId = await resolveOrCreateSession({ userId, sessionId });
    const recordingId = (0, crypto_1.randomUUID)();
    await prisma_1.prisma.coughRecording.create({
        data: {
            recordingId,
            sessionId: resolvedSessionId,
            fileUri: deviceId ? `iot://${deviceId}` : null,
            mimeType: norm.mimeType,
            rawData: (0, upload_1.toBytes)(file.buffer),
            byteSize: file.buffer.length,
            source: "iot",
        },
    });
    res.status(201).json({
        ok: true,
        recording: {
            recordingId,
            sessionId: resolvedSessionId,
            userId,
            mimeType: norm.mimeType,
            byteSize: file.buffer.length,
            source: "iot",
        },
    });
}
/** POST /iot/sputum-images */
async function iotUploadSputum(req, res) {
    const body = bodyOf(req);
    const userId = (0, http_1.getString)(body.userId);
    if (!userId)
        throw new http_1.HttpError(400, "userId is required");
    const sessionId = (0, http_1.getString)(body.sessionId) ?? undefined;
    const deviceId = (0, http_1.getString)(body.deviceId) ?? null;
    const file = (0, upload_1.readUploadedFile)(req);
    if (!file) {
        throw new http_1.HttpError(400, "Missing image. Send multipart `file` or JSON `fileBase64`.");
    }
    const norm = (0, upload_1.normalizeImageMime)(file.mimeType, file.filename);
    const resolvedSessionId = await resolveOrCreateSession({ userId, sessionId });
    // sputum_images is unique per session — overwrite if one already exists.
    const existing = await prisma_1.prisma.sputumImage.findUnique({
        where: { sessionId: resolvedSessionId },
        select: { imageId: true },
    });
    const imageId = existing?.imageId ?? (0, crypto_1.randomUUID)();
    if (existing) {
        await prisma_1.prisma.sputumImage.update({
            where: { sessionId: resolvedSessionId },
            data: {
                fileUri: deviceId ? `iot://${deviceId}` : null,
                mimeType: norm.mimeType,
                rawData: (0, upload_1.toBytes)(file.buffer),
                byteSize: file.buffer.length,
                source: "iot",
            },
        });
    }
    else {
        await prisma_1.prisma.sputumImage.create({
            data: {
                imageId,
                sessionId: resolvedSessionId,
                fileUri: deviceId ? `iot://${deviceId}` : null,
                mimeType: norm.mimeType,
                rawData: (0, upload_1.toBytes)(file.buffer),
                byteSize: file.buffer.length,
                source: "iot",
            },
        });
    }
    res.status(201).json({
        ok: true,
        image: {
            imageId,
            sessionId: resolvedSessionId,
            userId,
            mimeType: norm.mimeType,
            byteSize: file.buffer.length,
            source: "iot",
        },
    });
}
/** GET /iot/health */
function iotHealth(_req, res) {
    res.json({ ok: true, service: "tbhon-iot", time: new Date().toISOString() });
}
/** POST /iot/hello */
function iotHello(req, res) {
    const body = req.body;
    const message = typeof body === "string"
        ? body
        : (0, http_1.isRecord)(body)
            ? (0, http_1.getString)(body.message) ?? (0, http_1.getString)(body.hello) ?? ""
            : "";
    console.log(`[iot] hello received: "${message}" from ${req.ip}`);
    res.json({
        ok: true,
        service: "tbhon-iot",
        received: message,
        time: new Date().toISOString(),
    });
}
/** POST /iot/device-command */
function iotDeviceCommand(req, res) {
    const body = bodyOf(req);
    const command = parseDeviceCommand(body.command) ??
        parseDeviceCommand(body.type) ??
        parseDeviceCommand(body.mode);
    if (!command) {
        throw new http_1.HttpError(400, "command is required and must be `image`, `audio`, or `audio upload`");
    }
    if (command === "audio upload") {
        assertAudioUploadAllowed();
    }
    const queued = {
        command,
        queuedAt: new Date().toISOString(),
        source: "device-command",
        byIp: req.ip ?? "unknown",
    };
    pendingDeviceCommand = queued;
    res.status(201).json({
        ok: true,
        message: `Queued '${formatDeviceCommandForFirmware(queued)}' command for device`,
        command: queued.command,
        minSeconds: queued.command === "audio" ? AUDIO_MIN_SECONDS : null,
        maxSeconds: queued.command === "audio" ? AUDIO_MAX_SECONDS : null,
        queuedAt: queued.queuedAt,
    });
}
/** GET /iot/device-command */
function iotGetDeviceCommand(req, res) {
    const current = pendingDeviceCommand;
    const shouldConsume = getConsumeQueryValue(req);
    if (shouldConsume) {
        if (current === pendingDeviceCommand) {
            pendingDeviceCommand = null;
        }
        if (current?.command === "audio") {
            activeAudioCapture = {
                startedAtMs: Date.now(),
                minSeconds: AUDIO_MIN_SECONDS,
            };
        }
        else if (current?.command === "audio upload") {
            activeAudioCapture = null;
        }
    }
    // ESP32 firmware reads raw body text via client.readString().
    res.type("text/plain");
    res.send(current ? formatDeviceCommandForFirmware(current) : "");
}
/** POST /iot/trigger */
function iotSetTrigger(req, res) {
    const body = bodyOf(req);
    const command = parseDeviceCommand(body.command) ??
        parseDeviceCommand(body.trigger) ??
        parseDeviceCommand(body.type);
    if (!command) {
        throw new http_1.HttpError(400, "command is required and must be `image`, `audio`, or `audio upload`");
    }
    if (command === "audio upload") {
        assertAudioUploadAllowed();
    }
    const queued = {
        command,
        queuedAt: new Date().toISOString(),
        source: "trigger",
        byIp: req.ip ?? "unknown",
    };
    pendingDeviceCommand = queued;
    res.status(201).json({
        ok: true,
        command: queued.command,
        minSeconds: queued.command === "audio" ? AUDIO_MIN_SECONDS : null,
        maxSeconds: queued.command === "audio" ? AUDIO_MAX_SECONDS : null,
        queuedAt: queued.queuedAt,
        source: queued.source,
    });
}
/** GET /iot/trigger */
function iotGetTrigger(req, res) {
    const current = pendingDeviceCommand;
    if (!current) {
        res.json({
            ok: true,
            pending: false,
            command: null,
        });
        return;
    }
    if (getConsumeQueryValue(req)) {
        if (current === pendingDeviceCommand) {
            pendingDeviceCommand = null;
        }
        if (current.command === "audio") {
            activeAudioCapture = {
                startedAtMs: Date.now(),
                minSeconds: AUDIO_MIN_SECONDS,
            };
        }
        else if (current.command === "audio upload") {
            activeAudioCapture = null;
        }
    }
    res.json({
        ok: true,
        pending: true,
        command: current.command,
        minSeconds: current.command === "audio" ? AUDIO_MIN_SECONDS : null,
        maxSeconds: current.command === "audio" ? AUDIO_MAX_SECONDS : null,
        firmwareCommand: formatDeviceCommandForFirmware(current),
        queuedAt: current.queuedAt,
        source: current.source,
        consume: getConsumeQueryValue(req),
    });
}
/** GET /iot/sputum-images/:sessionId/file?userId=... */
async function iotDownloadSputum(req, res) {
    const sessionId = getSingleValue(req.params.sessionId);
    const userId = getSingleValue(req.query.userId);
    if (!sessionId)
        throw new http_1.HttpError(400, "sessionId is required");
    if (!userId)
        throw new http_1.HttpError(400, "userId is required");
    const session = await prisma_1.prisma.screeningSession.findFirst({
        where: { sessionId, userId },
        select: { sessionId: true },
    });
    if (!session) {
        throw new http_1.HttpError(404, "Screening session not found");
    }
    const image = await prisma_1.prisma.sputumImage.findUnique({
        where: { sessionId },
        select: {
            imageId: true,
            mimeType: true,
            rawData: true,
            byteSize: true,
        },
    });
    if (!image?.rawData) {
        throw new http_1.HttpError(404, "Sputum image file not found");
    }
    const mimeType = image.mimeType ?? "application/octet-stream";
    const ext = imageFilenameExt(image.mimeType);
    const bytes = Buffer.from(image.rawData);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", String(image.byteSize ?? bytes.length));
    res.setHeader("Content-Disposition", `inline; filename="sputum-${image.imageId ?? sessionId}.${ext}"`);
    res.send(bytes);
}
//# sourceMappingURL=iot.controller.js.map