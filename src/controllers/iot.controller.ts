import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../prisma";
import { HttpError, getString, isRecord } from "../utils/http";
import { normalizeAudioMime, normalizeImageMime, readUploadedFile, toBytes } from "../utils/upload";

/**
 * IoT (ESP32 / microcontroller) HTTP API.
 *
 * All endpoints are gated by `requireIotKey` (X-IoT-Key header). Devices then
 * send `userId` (required) and optionally `sessionId` (existing session). If
 * no `sessionId` is provided, a new screening session is created on the fly so
 * the standalone IoT device can record without going through the mobile app.
 *
 * Two body styles are accepted:
 *   1. multipart/form-data with field `file` (recommended).
 *   2. application/json with `{ userId, sessionId?, mimeType?, fileBase64 }`.
 */

type Body = Record<string, unknown>;

type DeviceCommandType = "image" | "audio" | "audio upload";

const AUDIO_MIN_SECONDS = 3;
const AUDIO_MAX_SECONDS = 10;

type DeviceCommandState = {
  command: DeviceCommandType;
  queuedAt: string;
  source: "device-command" | "trigger";
  byIp: string;
};

type ActiveAudioCapture = {
  startedAtMs: number;
  minSeconds: number;
};

let pendingDeviceCommand: DeviceCommandState | null = null;
let activeAudioCapture: ActiveAudioCapture | null = null;

function bodyOf(req: Request): Body {
  return isRecord(req.body) ? (req.body as Body) : {};
}

function parseDeviceCommand(raw: unknown): DeviceCommandType | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "image") return "image";
  if (["audio", "audio start", "audio-start", "audio_start"].includes(normalized)) {
    return "audio";
  }
  if (
    ["audio upload", "audio-upload", "audio_upload", "stop", "stop-audio", "stop_audio", "stopaudio"].includes(
      normalized,
    )
  ) {
    return "audio upload";
  }
  return null;
}

function getActiveAudioElapsedSeconds(): number | null {
  if (!activeAudioCapture) return null;
  return (Date.now() - activeAudioCapture.startedAtMs) / 1000;
}

function assertAudioUploadAllowed() {
  const elapsedSeconds = getActiveAudioElapsedSeconds();
  if (!activeAudioCapture || elapsedSeconds === null) {
    throw new HttpError(409, "No active audio recording to upload");
  }
  if (elapsedSeconds < AUDIO_MIN_SECONDS) {
    throw new HttpError(
      409,
      `Audio upload can only be requested after ${AUDIO_MIN_SECONDS} seconds`,
    );
  }
}

function formatDeviceCommandForFirmware(command: DeviceCommandState): string {
  return command.command;
}

function getSingleValue(raw: unknown): string | undefined {
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0].trim();
  return undefined;
}

function getConsumeQueryValue(req: Request): boolean {
  const q = getSingleValue(req.query.consume);
  if (!q) return true;
  return !["0", "false", "no"].includes(q.toLowerCase());
}

function imageFilenameExt(mimeType: string | null): string {
  if (!mimeType) return "bin";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  return "bin";
}

async function resolveOrCreateSession(args: {
  userId: string;
  sessionId?: string | undefined;
}): Promise<string> {
  const { userId, sessionId } = args;

  if (sessionId) {
    const existing = await prisma.screeningSession.findFirst({
      where: { sessionId, userId },
      select: { sessionId: true },
    });
    if (existing) return existing.sessionId;
  }

  const userExists = await prisma.user.findUnique({
    where: { userId },
    select: { userId: true },
  });
  if (!userExists) {
    throw new HttpError(404, "Unknown userId");
  }

  const newSessionId = sessionId ?? randomUUID();
  await prisma.screeningSession.create({
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
export async function iotUploadCough(req: Request, res: Response) {
  const body = bodyOf(req);
  const userId = getString(body.userId);
  if (!userId) throw new HttpError(400, "userId is required");
  const sessionId = getString(body.sessionId) ?? undefined;
  const deviceId = getString(body.deviceId) ?? null;

  const file = readUploadedFile(req);
  if (!file) {
    throw new HttpError(400, "Missing audio. Send multipart `file` or JSON `fileBase64`.");
  }
  const norm = normalizeAudioMime(file.mimeType, file.filename);

  const resolvedSessionId = await resolveOrCreateSession({ userId, sessionId });

  const recordingId = randomUUID();
  await prisma.coughRecording.create({
    data: {
      recordingId,
      sessionId: resolvedSessionId,
      fileUri: deviceId ? `iot://${deviceId}` : null,
      mimeType: norm.mimeType,
      rawData: toBytes(file.buffer),
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
export async function iotUploadSputum(req: Request, res: Response) {
  const body = bodyOf(req);
  const userId = getString(body.userId);
  if (!userId) throw new HttpError(400, "userId is required");
  const sessionId = getString(body.sessionId) ?? undefined;
  const deviceId = getString(body.deviceId) ?? null;

  const file = readUploadedFile(req);
  if (!file) {
    throw new HttpError(400, "Missing image. Send multipart `file` or JSON `fileBase64`.");
  }
  const norm = normalizeImageMime(file.mimeType, file.filename);

  const resolvedSessionId = await resolveOrCreateSession({ userId, sessionId });

  // sputum_images is unique per session — overwrite if one already exists.
  const existing = await prisma.sputumImage.findUnique({
    where: { sessionId: resolvedSessionId },
    select: { imageId: true },
  });

  const imageId = existing?.imageId ?? randomUUID();
  if (existing) {
    await prisma.sputumImage.update({
      where: { sessionId: resolvedSessionId },
      data: {
        fileUri: deviceId ? `iot://${deviceId}` : null,
        mimeType: norm.mimeType,
        rawData: toBytes(file.buffer),
        byteSize: file.buffer.length,
        source: "iot",
      },
    });
  } else {
    await prisma.sputumImage.create({
      data: {
        imageId,
        sessionId: resolvedSessionId,
        fileUri: deviceId ? `iot://${deviceId}` : null,
        mimeType: norm.mimeType,
        rawData: toBytes(file.buffer),
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
export function iotHealth(_req: Request, res: Response) {
  res.json({ ok: true, service: "tbhon-iot", time: new Date().toISOString() });
}

/** POST /iot/hello */
export function iotHello(req: Request, res: Response) {
  const body = req.body;
  const message =
    typeof body === "string"
      ? body
      : isRecord(body)
        ? getString(body.message) ?? getString(body.hello) ?? ""
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
export function iotDeviceCommand(req: Request, res: Response) {
  const body = bodyOf(req);
  const command =
    parseDeviceCommand(body.command) ??
    parseDeviceCommand(body.type) ??
    parseDeviceCommand(body.mode);

  if (!command) {
    throw new HttpError(400, "command is required and must be `image`, `audio`, or `audio upload`");
  }
  if (command === "audio upload") {
    assertAudioUploadAllowed();
  }

  const queued: DeviceCommandState = {
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
export function iotGetDeviceCommand(req: Request, res: Response) {
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
    } else if (current?.command === "audio upload") {
      activeAudioCapture = null;
    }
  }

  // ESP32 firmware reads raw body text via client.readString().
  res.type("text/plain");
  res.send(current ? formatDeviceCommandForFirmware(current) : "");
}

/** POST /iot/trigger */
export function iotSetTrigger(req: Request, res: Response) {
  const body = bodyOf(req);
  const command =
    parseDeviceCommand(body.command) ??
    parseDeviceCommand(body.trigger) ??
    parseDeviceCommand(body.type);

  if (!command) {
    throw new HttpError(400, "command is required and must be `image`, `audio`, or `audio upload`");
  }
  if (command === "audio upload") {
    assertAudioUploadAllowed();
  }

  const queued: DeviceCommandState = {
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
export function iotGetTrigger(req: Request, res: Response) {
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
    } else if (current.command === "audio upload") {
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
export async function iotDownloadSputum(req: Request, res: Response) {
  const sessionId = getSingleValue(req.params.sessionId);
  const userId = getSingleValue(req.query.userId);

  if (!sessionId) throw new HttpError(400, "sessionId is required");
  if (!userId) throw new HttpError(400, "userId is required");

  const session = await prisma.screeningSession.findFirst({
    where: { sessionId, userId },
    select: { sessionId: true },
  });
  if (!session) {
    throw new HttpError(404, "Screening session not found");
  }

  const image = await prisma.sputumImage.findUnique({
    where: { sessionId },
    select: {
      imageId: true,
      mimeType: true,
      rawData: true,
      byteSize: true,
    },
  });

  if (!image?.rawData) {
    throw new HttpError(404, "Sputum image file not found");
  }

  const mimeType = image.mimeType ?? "application/octet-stream";
  const ext = imageFilenameExt(image.mimeType);
  const bytes = Buffer.from(image.rawData);

  res.setHeader("Content-Type", mimeType);
  res.setHeader("Content-Length", String(image.byteSize ?? bytes.length));
  res.setHeader(
    "Content-Disposition",
    `inline; filename="sputum-${image.imageId ?? sessionId}.${ext}"`,
  );
  res.send(bytes);
}
