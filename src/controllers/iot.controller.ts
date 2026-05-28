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

type DeviceCommandSource = "device-command" | "trigger" | "mobile";

export type DeviceCommandContext = {
  userId?: string;
  sessionId?: string;
  /** Which cough slot (1-based) this audio command is for. */
  coughAttempt?: number;
};

type DeviceCommandState = {
  command: DeviceCommandType;
  queuedAt: string;
  source: DeviceCommandSource;
  byIp: string;
  userId?: string;
  sessionId?: string;
  coughAttempt?: number;
};

export type QueueDeviceCommandResult = {
  command: DeviceCommandType;
  message: string;
  minSeconds: number | null;
  maxSeconds: number | null;
  queuedAt: string;
  source: DeviceCommandSource;
  userId: string | null;
  sessionId: string | null;
  coughAttempt: number | null;
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

export function parseDeviceCommand(raw: unknown): DeviceCommandType | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "image") return "image";
  if (["audio", "audio start", "audio-start", "audio_start"].includes(normalized)) {
    return "audio";
  }
  if (
    [
      "audio upload",
      "audio-upload",
      "audio_upload",
      "stop",
      "stop audio",
      "stop-audio",
      "stop_audio",
      "stopaudio",
    ].includes(normalized)
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

/**
 * Plain-text body for GET /iot/device-command.
 * Legacy: `image` | `audio` | `audio upload`
 * With app context: one-line JSON, e.g. {"command":"image","userId":"...","sessionId":"..."}
 */
function formatDeviceCommandForFirmware(command: DeviceCommandState): string {
  if (command.userId || command.sessionId) {
    return JSON.stringify({
      command: command.command,
      queuedAt: command.queuedAt,
      ...(command.userId ? { userId: command.userId } : {}),
      ...(command.sessionId ? { sessionId: command.sessionId } : {}),
      ...(command.coughAttempt != null ? { coughAttempt: command.coughAttempt } : {}),
    });
  }
  return command.command;
}

/** Drop a pending `image` command after the device uploaded for that session. */
export function clearPendingImageCommandForSession(sessionId: string) {
  if (
    pendingDeviceCommand?.command === "image" &&
    pendingDeviceCommand.sessionId === sessionId
  ) {
    pendingDeviceCommand = null;
  }
}

function readDeviceCommandContext(body: Body): DeviceCommandContext {
  const userId = getString(body.userId);
  const sessionId = getString(body.sessionId);
  if ((userId && !sessionId) || (!userId && sessionId)) {
    throw new HttpError(400, "userId and sessionId must be sent together");
  }
  const rawAttempt = body.coughAttempt;
  const coughAttempt =
    typeof rawAttempt === "number" && Number.isInteger(rawAttempt) && rawAttempt >= 1
      ? rawAttempt
      : typeof rawAttempt === "string" && /^\d+$/.test(rawAttempt.trim())
        ? parseInt(rawAttempt.trim(), 10)
        : undefined;
  if (userId && sessionId) {
    return { userId, sessionId, ...(coughAttempt != null ? { coughAttempt } : {}) };
  }
  return {};
}

/** Shared queue used by /iot/device-command, /iot/trigger, and the mobile JWT route. */
export function queueDeviceCommand(
  command: DeviceCommandType,
  meta: { source: DeviceCommandSource; byIp?: string },
  context?: DeviceCommandContext,
): QueueDeviceCommandResult {
  if (command === "audio upload") {
    assertAudioUploadAllowed();
  } else if (command === "audio") {
    // Mobile or POST can queue start before the device GET; stop/upload still needs a timer.
    activeAudioCapture = {
      startedAtMs: Date.now(),
      minSeconds: AUDIO_MIN_SECONDS,
    };
  }

  const queued: DeviceCommandState = {
    command,
    queuedAt: new Date().toISOString(),
    source: meta.source,
    byIp: meta.byIp ?? "unknown",
    ...(context?.userId ? { userId: context.userId } : {}),
    ...(context?.sessionId ? { sessionId: context.sessionId } : {}),
    ...(context?.coughAttempt != null ? { coughAttempt: context.coughAttempt } : {}),
  };
  pendingDeviceCommand = queued;

  return {
    command: queued.command,
    message: `Queued '${queued.command}' command for device`,
    minSeconds: queued.command === "audio" ? AUDIO_MIN_SECONDS : null,
    maxSeconds: queued.command === "audio" ? AUDIO_MAX_SECONDS : null,
    queuedAt: queued.queuedAt,
    source: queued.source,
    userId: queued.userId ?? null,
    sessionId: queued.sessionId ?? null,
    coughAttempt: queued.coughAttempt ?? null,
  };
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

export async function resolveOrCreateSession(args: {
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

  // coughAttempt (1-based) identifies which slot this recording fills.
  // When provided, we upsert that slot so a retake replaces the old bytes
  // instead of appending a new row. When absent (legacy firmware), we insert.
  const rawAttempt = body.coughAttempt;
  const coughAttempt =
    typeof rawAttempt === "number" && Number.isInteger(rawAttempt) && rawAttempt >= 1
      ? rawAttempt
      : typeof rawAttempt === "string" && /^\d+$/.test(rawAttempt.trim())
        ? parseInt(rawAttempt.trim(), 10)
        : null;

  const file = readUploadedFile(req);
  if (!file) {
    throw new HttpError(400, "Missing audio. Send multipart `file` or JSON `fileBase64`.");
  }
  const norm = normalizeAudioMime(file.mimeType, file.filename);

  const resolvedSessionId = await resolveOrCreateSession({ userId, sessionId });

  let recordingId: string;

  if (coughAttempt !== null) {
    // Upsert by (sessionId, coughAttempt) — retake replaces the row in-place.
    const existing = await prisma.coughRecording.findFirst({
      where: { sessionId: resolvedSessionId, coughAttempt },
      select: { recordingId: true },
    });

    if (existing) {
      recordingId = existing.recordingId;
      await prisma.coughRecording.update({
        where: { recordingId },
        data: {
          fileUri: deviceId ? `iot://${deviceId}` : null,
          mimeType: norm.mimeType,
          rawData: toBytes(file.buffer),
          byteSize: file.buffer.length,
          recordedAt: new Date(),
        },
      });
    } else {
      recordingId = randomUUID();
      await prisma.coughRecording.create({
        data: {
          recordingId,
          sessionId: resolvedSessionId,
          coughAttempt,
          fileUri: deviceId ? `iot://${deviceId}` : null,
          mimeType: norm.mimeType,
          rawData: toBytes(file.buffer),
          byteSize: file.buffer.length,
          source: "iot",
        },
      });
    }
  } else {
    // Legacy firmware — no attempt number; always insert.
    recordingId = randomUUID();
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
  }

  res.status(201).json({
    ok: true,
    recording: {
      recordingId,
      sessionId: resolvedSessionId,
      userId,
      mimeType: norm.mimeType,
      byteSize: file.buffer.length,
      source: "iot",
      coughAttempt,
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
        capturedAt: new Date(),
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

  clearPendingImageCommandForSession(resolvedSessionId);

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
export async function iotDeviceCommand(req: Request, res: Response) {
  const body = bodyOf(req);
  const command =
    parseDeviceCommand(body.command) ??
    parseDeviceCommand(body.type) ??
    parseDeviceCommand(body.mode);

  if (!command) {
    throw new HttpError(400, "command is required and must be `image`, `audio`, or `audio upload`");
  }

  const context = readDeviceCommandContext(body);
  if (context.userId && context.sessionId) {
    await resolveOrCreateSession({ userId: context.userId, sessionId: context.sessionId });
  }

  const queued = queueDeviceCommand(
    command,
    {
      source: "device-command",
      byIp: req.ip ?? "unknown",
    },
    context,
  );

  res.status(201).json({ ok: true, ...queued });
}

/** GET /iot/device-command */
export function iotGetDeviceCommand(req: Request, res: Response) {
  const current = pendingDeviceCommand;
  const shouldConsume = getConsumeQueryValue(req);
  if (shouldConsume && current) {
    // Keep `image` in the queue until upload or a new POST replaces it — avoids
    // "NO COMMAND" on the next poll while the device is still capturing/uploading.
    if (current.command !== "image" && current === pendingDeviceCommand) {
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

  // ESP32 firmware reads raw body text via client.readString().
  res.type("text/plain");
  res.send(current ? formatDeviceCommandForFirmware(current) : "");
}

/** POST /iot/trigger */
export async function iotSetTrigger(req: Request, res: Response) {
  const body = bodyOf(req);
  const command =
    parseDeviceCommand(body.command) ??
    parseDeviceCommand(body.trigger) ??
    parseDeviceCommand(body.type);

  if (!command) {
    throw new HttpError(400, "command is required and must be `image`, `audio`, or `audio upload`");
  }

  const context = readDeviceCommandContext(body);
  if (context.userId && context.sessionId) {
    await resolveOrCreateSession({ userId: context.userId, sessionId: context.sessionId });
  }

  const queued = queueDeviceCommand(
    command,
    {
      source: "trigger",
      byIp: req.ip ?? "unknown",
    },
    context,
  );

  res.status(201).json({ ok: true, ...queued });
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
    if (current.command !== "image" && current === pendingDeviceCommand) {
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
    userId: current.userId ?? null,
    sessionId: current.sessionId ?? null,
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
