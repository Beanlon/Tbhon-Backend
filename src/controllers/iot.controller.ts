import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../prisma";
import { HttpError, getString, isRecord } from "../utils/http";
import {
  parseCoughAttempt,
  parseCoughAttemptStrict,
  upsertSessionCoughRecording,
} from "../utils/coughAttempt";
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

/** Device is "online" when it polled or sent presence within this window. */
const DEVICE_ONLINE_MS = 12_000;

/** Drop a stuck `audio` command if the bench never confirmed within this window. */
const AUDIO_COMMAND_STALE_MS = 90_000;

export type IotHardwareState = "offline" | "idle" | "recording" | "uploading";

type DevicePresenceState = {
  state: IotHardwareState;
  lastSeenAtMs: number;
  byIp: string | null;
};

let devicePresence: DevicePresenceState = {
  state: "offline",
  lastSeenAtMs: 0,
  byIp: null,
};

function parseHardwareState(raw: string | undefined): Exclude<IotHardwareState, "offline"> | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "idle" || normalized === "recording" || normalized === "uploading") {
    return normalized;
  }
  return null;
}

export function touchDevicePresence(
  state: Exclude<IotHardwareState, "offline">,
  byIp?: string | null,
) {
  devicePresence = {
    state,
    lastSeenAtMs: Date.now(),
    byIp: byIp ?? devicePresence.byIp,
  };
}

export function getDevicePresenceSnapshot() {
  expireStaleAudioCommand();
  const online =
    devicePresence.lastSeenAtMs > 0 &&
    Date.now() - devicePresence.lastSeenAtMs <= DEVICE_ONLINE_MS;
  const state: IotHardwareState = online ? devicePresence.state : "offline";
  if (state === "idle" || state === "uploading") {
    activeAudioCapture = null;
  }
  const hasPending = pendingDeviceCommand !== null;
  const ready = online && state === "idle" && !hasPending && !activeAudioCapture;

  return {
    online,
    ready,
    state,
    lastSeenAt:
      devicePresence.lastSeenAtMs > 0
        ? new Date(devicePresence.lastSeenAtMs).toISOString()
        : null,
    pendingCommand: hasPending
      ? {
          command: pendingDeviceCommand!.command,
          queuedAt: pendingDeviceCommand!.queuedAt,
          userId: pendingDeviceCommand!.userId ?? null,
          sessionId: pendingDeviceCommand!.sessionId ?? null,
          coughAttempt: pendingDeviceCommand!.coughAttempt ?? null,
        }
      : null,
    activeAudioCapture: activeAudioCapture
      ? {
          elapsedSeconds: getActiveAudioElapsedSeconds(),
          minSeconds: activeAudioCapture.minSeconds,
        }
      : null,
  };
}

type RecentUpload = {
  timestamp: string;
  type: "cough" | "sputum";
  userId: string;
  sessionId: string;
  coughAttempt: number | null;
  byteSize: number;
  recordingId: string;
};

const recentUploads: RecentUpload[] = [];
const MAX_RECENT_UPLOADS = 20;

function trackUpload(upload: RecentUpload) {
  recentUploads.unshift(upload);
  if (recentUploads.length > MAX_RECENT_UPLOADS) {
    recentUploads.pop();
  }
}

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

/** Start the capture clock when the bench actually begins recording (not when the app POST queues). */
function markDeviceRecordingStarted() {
  if (!activeAudioCapture) {
    activeAudioCapture = {
      startedAtMs: Date.now(),
      minSeconds: AUDIO_MIN_SECONDS,
    };
  }
}

function clearPendingAudioCommand() {
  if (pendingDeviceCommand?.command === "audio") {
    pendingDeviceCommand = null;
  }
}

/** Expire an `audio` command that was never picked up or finished. */
function expireStaleAudioCommand() {
  if (!pendingDeviceCommand || pendingDeviceCommand.command !== "audio") return;
  const ageMs = Date.now() - new Date(pendingDeviceCommand.queuedAt).getTime();
  if (ageMs > AUDIO_COMMAND_STALE_MS) {
    pendingDeviceCommand = null;
    activeAudioCapture = null;
  }
}

/**
 * Apply consume semantics when the device polls for a command.
 * `audio` stays queued until the bench confirms recording or upload completes so a
 * garbled HTTP body or missed poll does not drop the command after one GET.
 */
function consumeDeliveredDeviceCommand(current: DeviceCommandState, shouldConsume: boolean) {
  if (!shouldConsume) return;

  if (current.command === "audio") {
    markDeviceRecordingStarted();
    return;
  }

  if (current.command === "audio upload") {
    activeAudioCapture = null;
    if (current === pendingDeviceCommand) {
      pendingDeviceCommand = null;
    }
    return;
  }

  if (current.command !== "image" && current === pendingDeviceCommand) {
    pendingDeviceCommand = null;
  }
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
  const coughAttempt = parseCoughAttemptStrict(body.coughAttempt);
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
  }
  // `audio` timer starts in markDeviceRecordingStarted() when the device polls or sends presence.

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
  const timestamp = new Date().toISOString();
  console.log(`\n=== [${timestamp}] IOT COUGH UPLOAD RECEIVED ===`);
  console.log("[iot/cough-recordings] Body keys:", Object.keys(body).join(", "));
  console.log("[iot/cough-recordings] userId:", body.userId);
  console.log("[iot/cough-recordings] sessionId:", body.sessionId);
  console.log("[iot/cough-recordings] coughAttempt:", body.coughAttempt, "| cough_attempt:", body.cough_attempt);
  console.log("[iot/cough-recordings] deviceId:", body.deviceId);
  console.log("[iot/cough-recordings] IP:", req.ip);

  const userId = getString(body.userId);
  if (!userId) {
    console.log("[iot/cough-recordings] ERROR: userId is missing!");
    throw new HttpError(400, "userId is required");
  }
  const sessionId = getString(body.sessionId) ?? undefined;
  const deviceId = getString(body.deviceId) ?? null;
  
  console.log("[iot/cough-recordings] Parsed - userId:", userId, "sessionId:", sessionId);

  // coughAttempt (1–3) = which slot; retakes replace that row (see upsertSessionCoughRecording).
  // Accept both camelCase and snake_case from firmware.
  const rawAttempt = body.coughAttempt ?? body.cough_attempt;
  const coughAttempt = parseCoughAttempt(rawAttempt);
  console.log("[iot/cough-recordings] Parsed coughAttempt:", coughAttempt);

  const file = readUploadedFile(req);
  if (!file) {
    throw new HttpError(400, "Missing audio. Send multipart `file` or JSON `fileBase64`.");
  }
  const norm = normalizeAudioMime(file.mimeType, file.filename);

  const resolvedSessionId = await resolveOrCreateSession({ userId, sessionId });

  let recordingId: string;

  if (coughAttempt !== null) {
    recordingId = await upsertSessionCoughRecording(resolvedSessionId, coughAttempt, {
      fileUri: deviceId ? `iot://${deviceId}` : null,
      mimeType: norm.mimeType,
      rawData: file.buffer,
      byteSize: file.buffer.length,
      source: "iot",
    });
  } else {
    // Legacy firmware — no attempt number; always insert (may duplicate on retake).
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

  console.log(`[iot/cough-recordings] SUCCESS - Saved recording:`);
  console.log(`  recordingId: ${recordingId}`);
  console.log(`  sessionId: ${resolvedSessionId}`);
  console.log(`  userId: ${userId}`);
  console.log(`  coughAttempt: ${coughAttempt}`);
  console.log(`  byteSize: ${file.buffer.length}`);
  console.log(`=== IOT COUGH UPLOAD COMPLETE ===\n`);

  trackUpload({
    timestamp: new Date().toISOString(),
    type: "cough",
    userId,
    sessionId: resolvedSessionId,
    coughAttempt,
    byteSize: file.buffer.length,
    recordingId,
  });

  touchDevicePresence("idle", req.ip ?? null);
  activeAudioCapture = null;
  clearPendingAudioCommand();

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

/** GET /iot/debug/recent-uploads - Shows recent IoT uploads for debugging */
export function iotDebugRecentUploads(req: Request, res: Response) {
  const sessionFilter = getSingleValue(req.query.sessionId);
  const filtered = sessionFilter
    ? recentUploads.filter((u) => u.sessionId === sessionFilter || u.sessionId.startsWith(sessionFilter))
    : recentUploads;

  res.json({
    ok: true,
    count: filtered.length,
    filter: sessionFilter ?? null,
    uploads: filtered,
    pendingCommand: pendingDeviceCommand
      ? {
          command: pendingDeviceCommand.command,
          queuedAt: pendingDeviceCommand.queuedAt,
          userId: pendingDeviceCommand.userId ?? null,
          sessionId: pendingDeviceCommand.sessionId ?? null,
          coughAttempt: pendingDeviceCommand.coughAttempt ?? null,
        }
      : null,
    activeAudioCapture: activeAudioCapture
      ? {
          startedAtMs: activeAudioCapture.startedAtMs,
          elapsedSeconds: getActiveAudioElapsedSeconds(),
        }
      : null,
  });
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

/** POST /iot/presence — lightweight heartbeat from ESP32 (especially while recording). */
export function iotReportPresence(req: Request, res: Response) {
  const body = bodyOf(req);
  const state =
    parseHardwareState(getString(body.state)) ??
    parseHardwareState(getSingleValue(req.query.status));

  if (!state) {
    throw new HttpError(400, "state must be `idle`, `recording`, or `uploading`");
  }

  touchDevicePresence(state, req.ip ?? null);
  if (state === "recording") {
    markDeviceRecordingStarted();
    clearPendingAudioCommand();
  } else if (state === "uploading" || state === "idle") {
    // Bench finished capture — don't leave the mobile timer stuck on "recording".
    activeAudioCapture = null;
  }

  res.json({
    ok: true,
    ...getDevicePresenceSnapshot(),
  });
}

/** GET /iot/device-status — mobile app polls until device is online/ready/recording. */
export function iotGetDeviceStatus(_req: Request, res: Response) {
  res.json({
    ok: true,
    service: "tbhon-iot",
    time: new Date().toISOString(),
    ...getDevicePresenceSnapshot(),
  });
}

/** GET /iot/device-command */
export function iotGetDeviceCommand(req: Request, res: Response) {
  expireStaleAudioCommand();

  const pollState =
    parseHardwareState(getSingleValue(req.query.status)) ??
    parseHardwareState(req.header("x-device-state") ?? undefined);
  if (pollState) {
    // Firmware polls with ?status=idle between commands — don't wipe "recording" while capture runs.
    if (!(pollState === "idle" && activeAudioCapture)) {
      touchDevicePresence(pollState, req.ip ?? null);
    }
  }

  const current = pendingDeviceCommand;
  if (current) {
    consumeDeliveredDeviceCommand(current, getConsumeQueryValue(req));
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

  consumeDeliveredDeviceCommand(current, getConsumeQueryValue(req));

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
