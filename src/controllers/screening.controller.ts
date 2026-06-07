import type { Response } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../prisma";
import type { InputJsonValue } from "../types/input-json";
import type { AuthRequest } from "../types/auth";
import { HttpError, getString, isRecord } from "../utils/http";
import {
  getDevicePresenceSnapshot,
  parseDeviceCommand,
  queueDeviceCommand,
  resolveOrCreateSession,
} from "./iot.controller";
import {
  MAX_COUGH_ATTEMPTS,
  parseCoughAttemptStrict,
  type PrismaTransaction,
  upsertSessionCoughRecording,
} from "../utils/coughAttempt";
import {
  deleteIncompleteScreeningsForUser,
  purgeStaleIncompleteScreenings,
} from "../services/incompleteScreeningCleanup";
import { formatClientDisplayName, parseClientInput, serializeScreeningClient } from "../utils/client";
import { referralStatusForRisk, parseReferralStatus } from "../constants/referralStatus";
import {
  buildPatientClaimUrl,
  generatePatientAccessToken,
  isPatientAccessExpired,
  patientAccessExpiresAt,
} from "../utils/patientAccess";
import { maskEmail } from "../utils/emailMask";

const RISK_FALLBACK_REC = {
  low:
    "Low TB risk based on this screening. Maintain good health habits and monitor symptoms. Consult a professional if symptoms persist.",
  moderate:
    "Moderate TB risk. Schedule a consultation with a healthcare professional for further evaluation and testing.",
  high:
    "High TB risk. Please consult a healthcare professional as soon as possible for proper diagnosis and treatment.",
} as const;

function authenticatedUserId(req: AuthRequest): string {
  const userId = req.user?.userId;
  if (!userId) throw new HttpError(401, "Authentication is required");
  return userId;
}

function completedScreeningWhere(req: AuthRequest, userId: string) {
  if (req.user?.role === "PATIENT") {
    return { patientUserId: userId, completedAt: { not: null as Date | null } };
  }
  return { userId, completedAt: { not: null as Date | null } };
}

function screeningDetailWhere(req: AuthRequest, userId: string, sessionId: string) {
  if (req.user?.role === "PATIENT") {
    return { sessionId, patientUserId: userId };
  }
  return { sessionId, userId };
}

function parseJsonArrayOfStrings(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  }
  if (typeof raw === "string" && raw.trim().length > 0) {
    try {
      const v = JSON.parse(raw) as unknown;
      return Array.isArray(v)
        ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseChecklistPayloadRecord(body: Record<string, unknown>): InputJsonValue | undefined {
  let raw: unknown = body.checklist;
  if (typeof raw === "string" && raw.trim().length > 0) {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      return undefined;
    }
  }
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) return undefined;
  return raw as InputJsonValue;
}

function parseChecklistItems(body: Record<string, unknown>): { id: string; value: boolean }[] {
  let raw: unknown = body.checklist;
  if (typeof raw === "string" && raw.trim().length > 0) {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      return [];
    }
  }
  if (!isRecord(raw)) return [];
  const items = raw.items;
  if (!Array.isArray(items)) return [];
  const out: { id: string; value: boolean }[] = [];
  for (const item of items) {
    if (!isRecord(item)) continue;
    const id = getString(item.id);
    if (!id) continue;
    const value =
      item.value === true ||
      item.value === 1 ||
      item.value === "1" ||
      item.value === "true";
    out.push({ id, value });
  }
  return out;
}

function getOptionalNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function getBool(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function coerceRiskLevel(raw: unknown): "low" | "moderate" | "high" {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "moderate" || s === "high") return s;
  return "low";
}

function parsePhlegmProbs(raw: unknown): InputJsonValue | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === "string") {
    if (!raw.trim().length) return undefined;
    try {
      const v = JSON.parse(raw) as unknown;
      return v !== null && typeof v === "object" ? (v as InputJsonValue) : undefined;
    } catch {
      return undefined;
    }
  }
  if (typeof raw === "object") return raw as InputJsonValue;
  return undefined;
}

function parseInvalidReasons(raw: unknown): InputJsonValue | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (Array.isArray(raw)) {
    const strings = raw.filter((x): x is string => typeof x === "string");
    return strings as unknown as InputJsonValue;
  }
  if (typeof raw === "string") {
    try {
      const v = JSON.parse(raw) as unknown;
      return Array.isArray(v) ? (v as unknown as InputJsonValue) : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function inferMime(uri: string, fallbackAudio: string, fallbackImage: string): string {
  const lower = uri.split("?")[0]?.split("#")[0]?.toLowerCase() ?? "";
  if (lower.endsWith(".m4a") || lower.endsWith(".mp4") || lower.endsWith(".aac")) return "audio/mp4";
  if (lower.endsWith(".3gp") || lower.endsWith(".3gpp")) return "audio/3gpp";
  if (lower.endsWith(".caf")) return "audio/x-caf";
  if (lower.endsWith(".ogg") || lower.endsWith(".oga") || lower.endsWith(".opus")) return "audio/ogg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/heic";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.startsWith("file://") || lower.includes("audio")) return fallbackAudio;
  if (lower.startsWith("content://")) return fallbackAudio;
  return fallbackAudio;
}

function isPhoneLocalMediaUri(uri: string): boolean {
  const lower = uri.toLowerCase();
  return lower.startsWith("file://") || lower.startsWith("content://");
}

/** POST /screenings/draft — open session before IoT sample / screening finish. */
export async function createDraftScreening(req: AuthRequest, res: Response) {
  const userId = authenticatedUserId(req);
  // Starting a new screening: remove every prior incomplete session (no results page yet).
  const cleaned = await deleteIncompleteScreeningsForUser({ userId });
  if (cleaned.count > 0 && process.env.NODE_ENV !== "test") {
    console.log(
      `[Screening] Removed ${cleaned.count} incomplete session(s) for user before new draft`,
    );
  }

  const sessionId = randomUUID();
  await prisma.screeningSession.create({
    data: {
      sessionId,
      userId,
      startedAt: new Date(),
      apiAttempt: "mobile-draft",
    },
  });
  res.status(201).json({ ok: true, sessionId });
}

/** PUT /screenings/:sessionId/client — attach screened person to an open session. */
export async function upsertScreeningClient(req: AuthRequest, res: Response) {
  const userId = authenticatedUserId(req);
  const sessionId = getString(req.params.sessionId);
  if (!sessionId) throw new HttpError(400, "sessionId is required");
  if (!isRecord(req.body)) throw new HttpError(400, "Request body is required");

  const session = await prisma.screeningSession.findFirst({
    where: { sessionId, userId },
    include: { result: { select: { resultId: true } } },
  });
  if (!session) throw new HttpError(404, "Screening session not found");
  // Client may be attached after completion (walk-in booths).

  const data = parseClientInput(req.body.client ?? req.body);
  const client = await prisma.screeningClient.upsert({
    where: { sessionId },
    create: { clientId: randomUUID(), sessionId, ...data },
    update: data,
  });

  res.json({ ok: true, client: serializeScreeningClient(client) });
}

/** POST /screenings/iot/request-capture — queue image/audio for ESP32 (JWT, no IoT key on phone). */
export async function requestIotCapture(req: AuthRequest, res: Response) {
  const userId = authenticatedUserId(req);
  if (!isRecord(req.body)) {
    throw new HttpError(400, "Request body is required");
  }
  const command = parseDeviceCommand(req.body.command) ?? parseDeviceCommand(req.body.type);
  if (!command || command === "audio upload") {
    throw new HttpError(400, "command must be `image` or `audio`");
  }

  const sessionId = getString(req.body.sessionId);
  if (sessionId) {
    const owned = await prisma.screeningSession.findFirst({
      where: { sessionId, userId },
      select: { sessionId: true, result: { select: { resultId: true } } },
    });
    if (!owned) throw new HttpError(404, "Screening session not found");
    if (owned.result) throw new HttpError(409, "Screening already completed");
  }

  if (sessionId) {
    await resolveOrCreateSession({ userId, sessionId });
  }

  const coughAttempt =
    command === "audio" ? parseCoughAttemptStrict(req.body.coughAttempt) : undefined;

  const queued = queueDeviceCommand(
    command,
    { source: "mobile", byIp: req.ip ?? "unknown" },
    sessionId
      ? {
          userId,
          sessionId,
          ...(coughAttempt != null ? { coughAttempt } : {}),
        }
      : undefined,
  );
  res.status(201).json({ ok: true, ...queued, sessionId: sessionId ?? null });
}

/** GET /screenings/iot/device-status — JWT alias for mobile (no IoT key required). */
export function getIotDeviceStatus(_req: AuthRequest, res: Response) {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    ...getDevicePresenceSnapshot(),
  });
}

export async function completeScreening(req: AuthRequest, res: Response) {
  const userId = authenticatedUserId(req);
  if (!isRecord(req.body)) {
    throw new HttpError(400, "Request body is required");
  }

  const riskLevel = coerceRiskLevel(req.body.riskLevel ?? req.body.risk);
  const rec = getString(req.body.recommendation);
  const recommendation = rec ?? RISK_FALLBACK_REC[riskLevel];

  const checklistItems = parseChecklistItems(req.body);
  const checklistPayload = parseChecklistPayloadRecord(req.body);
  const audioUris = parseJsonArrayOfStrings(req.body.audioUris);
  const imageUri = getString(req.body.imageUri);
  const uploadError = getBool(req.body.uploadError);
  const invalidAudio = getBool(req.body.invalidAudio);
  const invalidLabel = getString(req.body.invalidAudioLabel ?? req.body.invalidLabel);
  const invalidReasons = parseInvalidReasons(req.body.invalidAudioReasons ?? req.body.invalidReasons);
  const apiAttemptRaw = getString(req.body.apiAttempt);
  const averageTbProbability = getOptionalNumber(req.body.averageTbProbability ?? req.body.probTb);

  const phlegmAnalyzed = getBool(req.body.phlegmAnalyzed);
  const phlegmLoad = getString(req.body.phlegmLoad) ?? "";
  const phlegmConfidence = getOptionalNumber(req.body.phlegmConfidence);
  const phlegmProbs = parsePhlegmProbs(req.body.phlegmProbs);

  const sputumSkipReason = getString(req.body.sputumSkipReason);
  const staffNotes = getString(req.body.staffNotes);
  const staffResultConfirmed = getBool(req.body.staffResultConfirmed);

  const draftSessionId = getString(req.body.sessionId);
  let sessionId: string;
  let completingDraft = false;

  if (draftSessionId) {
    const draft = await prisma.screeningSession.findFirst({
      where: { sessionId: draftSessionId, userId },
      include: { result: { select: { resultId: true } } },
    });
    if (!draft) throw new HttpError(404, "Screening session not found");
    if (draft.result) throw new HttpError(409, "Screening already completed");
    sessionId = draft.sessionId;
    completingDraft = true;
  } else {
    sessionId = randomUUID();
  }

  await prisma.$transaction(async (tx: PrismaTransaction) => {
    const knownQuestions = await tx.symptomQuestion.findMany({ select: { questionId: true } });
    const known = new Set(knownQuestions.map((q: { questionId: string }) => q.questionId));
    const symptomCreates = checklistItems
      .filter((x) => known.has(x.id))
      .map((x) => ({
        responseId: randomUUID(),
        questionId: x.id,
        answerValue: x.value,
      }));

    if (completingDraft) {
      await tx.screeningSession.update({
        where: { sessionId },
        data: {
          completedAt: new Date(),
          finalRiskLevel: riskLevel,
          averageTbProbability:
            averageTbProbability !== null && averageTbProbability !== undefined
              ? averageTbProbability
              : null,
          uploadError,
          apiAttempt: apiAttemptRaw ?? "mobile-draft",
          ...(checklistPayload !== undefined ? { checklistPayload } : {}),
          ...(sputumSkipReason ? { sputumSkipReason } : {}),
          ...(staffNotes ? { staffNotes } : {}),
          ...(staffResultConfirmed ? { staffResultConfirmedAt: new Date() } : {}),
        },
      });
      await tx.symptomResponse.deleteMany({ where: { sessionId } });
      if (symptomCreates.length > 0) {
        await tx.symptomResponse.createMany({
          data: symptomCreates.map((s) => ({ ...s, sessionId })),
        });
      }
    } else {
      await tx.screeningSession.create({
        data: {
          sessionId,
          userId,
          completedAt: new Date(),
          finalRiskLevel: riskLevel,
          averageTbProbability:
            averageTbProbability !== null && averageTbProbability !== undefined
              ? averageTbProbability
              : null,
          uploadError,
          apiAttempt: apiAttemptRaw ?? null,
          ...(checklistPayload !== undefined ? { checklistPayload } : {}),
          ...(sputumSkipReason ? { sputumSkipReason } : {}),
          ...(staffNotes ? { staffNotes } : {}),
          ...(staffResultConfirmed ? { staffResultConfirmedAt: new Date() } : {}),
          symptomResponses: { create: symptomCreates },
        },
      });
    }

    const recordingIds: string[] = [];
    const urisToLink = audioUris.slice(0, MAX_COUGH_ATTEMPTS);
    for (let i = 0; i < urisToLink.length; i++) {
      const uri = urisToLink[i];
      if (!uri) continue;
      const coughAttempt = i + 1;
      const recordingId = await upsertSessionCoughRecording(
        sessionId,
        coughAttempt,
        {
          fileUri: uri,
          mimeType: inferMime(uri, "audio/wav", "image/jpeg"),
          rawData: Buffer.alloc(0),
          byteSize: 0,
          source: "mobile",
        },
        tx,
      );
      recordingIds.push(recordingId);
    }

    const firstRecordingId =
      recordingIds[0] ??
      (
        await tx.coughRecording.findFirst({
          where: { sessionId },
          orderBy: [{ coughAttempt: "asc" }, { recordedAt: "asc" }],
          select: { recordingId: true },
        })
      )?.recordingId;
    if (firstRecordingId) {
      if (invalidAudio) {
        await tx.coughQualityCheck.create({
          data: {
            qualityCheckId: randomUUID(),
            recordingId: firstRecordingId,
            ok: false,
            label: invalidLabel ?? null,
            ...(invalidReasons !== undefined ? { reasonsJson: invalidReasons } : {}),
          },
        });
      }

      if (!invalidAudio && averageTbProbability !== null) {
        const pTb = Math.min(1, Math.max(0, averageTbProbability));
        const pNo = 1 - pTb;
        await tx.tbAudioPrediction.create({
          data: {
            predictionId: randomUUID(),
            recordingId: firstRecordingId,
            spoof: false,
            probNoTb: pNo,
            probTb: pTb,
            predictedClass: pTb >= 0.5 ? 1 : 0,
            modelPath: null,
          },
        });
      }
    }

    const existingSputum = await tx.sputumImage.findUnique({
      where: { sessionId },
      select: { imageId: true, byteSize: true, source: true },
    });

    let imageIdForPhlegm: string | null = existingSputum?.imageId ?? null;

    const hasStoredSputumBytes =
      typeof existingSputum?.byteSize === "number" && existingSputum.byteSize > 0;

    // Do not replace server-persisted bytes (e.g. IoT retake) with a stale phone path.
    if (
      imageUri &&
      imageUri.length > 0 &&
      isPhoneLocalMediaUri(imageUri) &&
      !hasStoredSputumBytes
    ) {
      const mimeType = inferMime(imageUri, "audio/wav", "image/jpeg");
      if (existingSputum) {
        await tx.sputumImage.update({
          where: { sessionId },
          data: {
            fileUri: imageUri,
            mimeType,
            source: "mobile",
          },
        });
      } else {
        imageIdForPhlegm = randomUUID();
        await tx.sputumImage.create({
          data: {
            imageId: imageIdForPhlegm,
            sessionId,
            fileUri: imageUri,
            mimeType,
            source: "mobile",
          },
        });
      }
    }

    if (imageIdForPhlegm && phlegmAnalyzed && phlegmLoad.length > 0) {
      await tx.phlegmPrediction.deleteMany({ where: { imageId: imageIdForPhlegm } });
      const conf = phlegmConfidence !== null ? phlegmConfidence : 0;
      await tx.phlegmPrediction.create({
        data: {
          phlegmPredictionId: randomUUID(),
          imageId: imageIdForPhlegm,
          predictedLoad: phlegmLoad,
          confidence: conf,
          ...(phlegmProbs !== undefined ? { probabilitiesJson: phlegmProbs } : {}),
          checkpoint: null,
        },
      });
    }

    await tx.screeningResult.create({
      data: {
        resultId: randomUUID(),
        sessionId,
        riskLevel,
        recommendation,
        invalidAudio,
        invalidAudioLabel: invalidLabel ?? null,
        ...(invalidReasons !== undefined ? { invalidAudioReasonsJson: invalidReasons } : {}),
        referralStatus: referralStatusForRisk(riskLevel),
        referralUpdatedAt: referralStatusForRisk(riskLevel) !== "none" ? new Date() : null,
      },
    });

    const patientAccessToken = generatePatientAccessToken();
    await tx.screeningSession.update({
      where: { sessionId },
      data: {
        patientAccessToken,
        patientAccessExpiresAt: patientAccessExpiresAt(),
      },
    });
  });

  const session = await prisma.screeningSession.findUnique({
    where: { sessionId },
    include: {
      result: true,
      coughRecordings: {
        select: {
          recordingId: true,
          mimeType: true,
          recordedAt: true,
          byteSize: true,
          coughAttempt: true,
        },
        orderBy: [{ coughAttempt: "asc" }, { recordedAt: "asc" }],
      },
      sputumImage: {
        select: { imageId: true, mimeType: true, byteSize: true },
      },
      _count: { select: { coughRecordings: true, symptomResponses: true } },
    },
  });

  // Drop other abandoned drafts for this user; keep the session that just finished.
  void deleteIncompleteScreeningsForUser({ userId, exceptSessionId: sessionId }).catch((err) => {
    console.error("[Screening] Post-complete incomplete cleanup failed:", err);
  });

  // Mobile clients use the returned recordingIds / imageId to attach the
  // actual raw bytes via `/screenings/:sessionId/(cough-recordings/:id|sputum-image)/raw`.
  const patientAccess =
    session?.patientAccessToken && !isPatientAccessExpired(session.patientAccessExpiresAt)
      ? {
          token: session.patientAccessToken,
          claimUrl: buildPatientClaimUrl(session.patientAccessToken),
          expiresAt: session.patientAccessExpiresAt?.toISOString() ?? null,
        }
      : null;

  res.status(201).json({ session, patientAccess });
}

/** DELETE /screenings/:sessionId — remove an incomplete session (no results / risk yet). */
export async function deleteIncompleteScreening(req: AuthRequest, res: Response) {
  const userId = authenticatedUserId(req);
  const sessionId = getString(req.params.sessionId);
  if (!sessionId) throw new HttpError(400, "sessionId is required");

  const row = await prisma.screeningSession.findFirst({
    where: { sessionId, userId },
    select: { sessionId: true, result: { select: { resultId: true } } },
  });
  if (!row) throw new HttpError(404, "Screening not found");
  if (row.result) {
    throw new HttpError(
      409,
      "Cannot delete a completed screening. Only sessions that never reached the results page can be removed.",
    );
  }

  await prisma.screeningSession.delete({ where: { sessionId } });
  res.json({ ok: true, sessionId, deleted: true });
}

/** POST /screenings/cleanup-incomplete — purge stale incomplete sessions (optional ?maxAgeHours=). */
export async function cleanupIncompleteScreenings(req: AuthRequest, res: Response) {
  authenticatedUserId(req);
  const maxAgeHoursRaw = getString((req.query as Record<string, unknown>).maxAgeHours);
  const maxAgeHours = maxAgeHoursRaw ? Number(maxAgeHoursRaw) : undefined;
  const result = await purgeStaleIncompleteScreenings(
    maxAgeHours !== undefined && Number.isFinite(maxAgeHours) ? { maxAgeHours } : undefined,
  );
  res.json({ ok: true, ...result });
}

export async function listMyScreenings(req: AuthRequest, res: Response) {
  const userId = authenticatedUserId(req);
  const limitRaw = getString((req.query as Record<string, unknown>).limit);
  const limit = Math.min(100, Math.max(1, Number(limitRaw ?? "50") || 50));

  const rows = await prisma.screeningSession.findMany({
    where: completedScreeningWhere(req, userId),
    orderBy: { completedAt: "desc" },
    take: limit,
    select: {
      sessionId: true,
      startedAt: true,
      completedAt: true,
      finalRiskLevel: true,
      averageTbProbability: true,
      uploadError: true,
      result: {
        select: {
          riskLevel: true,
          invalidAudio: true,
          createdAt: true,
          referralStatus: true,
          referralNotes: true,
          referralUpdatedAt: true,
        },
      },
      client: true,
      _count: {
        select: { coughRecordings: true, symptomResponses: true },
      },
    },
  });

  res.json({
    screenings: rows.map((row) => ({
      ...row,
      client: serializeScreeningClient(row.client),
    })),
  });
}

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function riskLabel(raw: string | null | undefined): string {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "moderate") return "Moderate";
  if (s === "high") return "High";
  return "Low";
}

/** CSV export for verified accounts (history download). */
export async function exportMyScreenings(req: AuthRequest, res: Response) {
  const userId = authenticatedUserId(req);
  const limit = 500;

  const rows = await prisma.screeningSession.findMany({
    where: completedScreeningWhere(req, userId),
    orderBy: { completedAt: "desc" },
    take: limit,
    select: {
      sessionId: true,
      completedAt: true,
      finalRiskLevel: true,
      averageTbProbability: true,
      result: { select: { riskLevel: true } },
      client: true,
    },
  });

  const header =
    "session_id,completed_at_utc,client_name,risk_level,tb_probability_percent,disclaimer";
  const disclaimer =
    "Screening aid only — not a medical diagnosis. Consult a healthcare professional.";
  const lines = rows.map((row) => {
    const risk = riskLabel(row.finalRiskLevel ?? row.result?.riskLevel);
    const completed = row.completedAt?.toISOString() ?? "";
    const prob =
      typeof row.averageTbProbability === "number" && Number.isFinite(row.averageTbProbability)
        ? (row.averageTbProbability * 100).toFixed(1)
        : "";
    const clientName = row.client ? formatClientDisplayName(row.client) : "";
    return [
      csvEscape(row.sessionId),
      csvEscape(completed),
      csvEscape(clientName),
      csvEscape(risk),
      csvEscape(prob),
      csvEscape(disclaimer),
    ].join(",");
  });

  const csv = [header, ...lines].join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="tbhon-screening-history.csv"');
  res.send(csv);
}

/** GET /screenings/:sessionId/patient-access — staff retrieves QR payload for result slip / PDF. */
export async function getPatientAccessForSession(req: AuthRequest, res: Response) {
  const userId = authenticatedUserId(req);
  const sessionId = getString(req.params.sessionId);
  if (!sessionId) throw new HttpError(400, "sessionId is required");

  const session = await prisma.screeningSession.findFirst({
    where: { sessionId, userId },
    select: {
      sessionId: true,
      patientAccessToken: true,
      patientAccessExpiresAt: true,
      patientUserId: true,
      patientUser: { select: { email: true } },
      result: { select: { resultId: true } },
    },
  });

  if (!session?.result) throw new HttpError(404, "Screening session not found");
  if (!session.patientAccessToken) throw new HttpError(404, "Patient access code not available");

  const alreadyClaimed = Boolean(session.patientUserId);
  if (!alreadyClaimed && isPatientAccessExpired(session.patientAccessExpiresAt)) {
    throw new HttpError(410, "Patient access code has expired");
  }

  res.json({
    sessionId: session.sessionId,
    token: session.patientAccessToken,
    claimUrl: buildPatientClaimUrl(session.patientAccessToken),
    expiresAt: session.patientAccessExpiresAt?.toISOString() ?? null,
    alreadyClaimed,
    maskedEmail: alreadyClaimed ? maskEmail(session.patientUser?.email) : null,
  });
}

export async function getMyScreening(req: AuthRequest, res: Response) {
  const userId = authenticatedUserId(req);
  const sessionId = getString(req.params.sessionId);
  if (!sessionId) throw new HttpError(400, "sessionId is required");

  const session = await prisma.screeningSession.findFirst({
    where: screeningDetailWhere(req, userId, sessionId),
    include: {
      result: true,
      client: true,
      symptomResponses: {
        include: { question: { select: { questionId: true, category: true, questionText: true } } },
      },
      coughRecordings: {
        select: {
          recordingId: true,
          sessionId: true,
          fileUri: true,
          mimeType: true,
          recordedAt: true,
          byteSize: true,
          source: true,
          coughAttempt: true,
          qualityCheck: true,
          audioPrediction: true,
        },
        orderBy: [{ coughAttempt: "asc" }, { recordedAt: "asc" }],
      },
      sputumImage: {
        select: {
          imageId: true,
          sessionId: true,
          fileUri: true,
          mimeType: true,
          capturedAt: true,
          byteSize: true,
          source: true,
          phlegmPrediction: true,
        },
      },
    },
  });

  if (!session) {
    throw new HttpError(404, "Screening not found");
  }

  // Annotate each media row with a canonical, server-served URL so any device
  // on this account can fetch the original bytes regardless of where they
  // were recorded. The mobile app appends the API base + bearer token.
  const coughRecordings = session.coughRecordings.map((r: (typeof session.coughRecordings)[number]) => ({
    ...r,
    hasRawData: typeof r.byteSize === "number" && r.byteSize > 0,
    fileUrl: `/screenings/${encodeURIComponent(session.sessionId)}/cough-recordings/${encodeURIComponent(r.recordingId)}/file`,
  }));

  const sputumImage =
    session.sputumImage && session.sputumImage.sessionId === session.sessionId
      ? {
          ...session.sputumImage,
          hasRawData:
            typeof session.sputumImage.byteSize === "number" && session.sputumImage.byteSize > 0,
          fileUrl: `/screenings/${encodeURIComponent(session.sessionId)}/sputum-image/file`,
        }
      : null;

  res.json({
    session: {
      ...session,
      client: serializeScreeningClient(session.client),
      coughRecordings,
      sputumImage,
    },
  });
}

/** PATCH /screenings/:sessionId/referral — staff documents GeneXpert / clinical follow-up. */
export async function updateScreeningReferral(req: AuthRequest, res: Response) {
  const userId = authenticatedUserId(req);
  const sessionId = getString(req.params.sessionId);
  if (!sessionId) throw new HttpError(400, "sessionId is required");
  if (!isRecord(req.body)) throw new HttpError(400, "Request body is required");

  const nextStatus = parseReferralStatus(req.body.referralStatus);
  const referralNotes = getString(req.body.referralNotes);

  const session = await prisma.screeningSession.findFirst({
    where: { sessionId, userId },
    include: { result: true },
  });
  if (!session) throw new HttpError(404, "Screening not found");
  if (!session.result) throw new HttpError(409, "Screening has no result yet");

  const referralStatus = nextStatus ?? session.result.referralStatus;

  const updated = await prisma.screeningResult.update({
    where: { sessionId },
    data: {
      referralStatus,
      ...(referralNotes !== undefined ? { referralNotes: referralNotes || null } : {}),
      referralUpdatedAt: new Date(),
    },
  });

  res.json({ ok: true, referral: updated });
}
