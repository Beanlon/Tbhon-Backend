import type { Response } from "express";
import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { AuthRequest } from "../types/auth";
import { HttpError, getString, isRecord } from "../utils/http";
import { parseDeviceCommand, queueDeviceCommand, resolveOrCreateSession } from "./iot.controller";
import {
  deleteIncompleteScreeningsForUser,
  purgeStaleIncompleteScreenings,
} from "../services/incompleteScreeningCleanup";

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

function parseChecklistPayloadRecord(body: Record<string, unknown>): Prisma.InputJsonValue | undefined {
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
  return raw as Prisma.InputJsonValue;
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

function parsePhlegmProbs(raw: unknown): Prisma.InputJsonValue | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === "string") {
    if (!raw.trim().length) return undefined;
    try {
      const v = JSON.parse(raw) as unknown;
      return v !== null && typeof v === "object" ? (v as Prisma.InputJsonValue) : undefined;
    } catch {
      return undefined;
    }
  }
  if (typeof raw === "object") return raw as Prisma.InputJsonValue;
  return undefined;
}

function parseInvalidReasons(raw: unknown): Prisma.InputJsonValue | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (Array.isArray(raw)) {
    const strings = raw.filter((x): x is string => typeof x === "string");
    return strings as unknown as Prisma.InputJsonValue;
  }
  if (typeof raw === "string") {
    try {
      const v = JSON.parse(raw) as unknown;
      return Array.isArray(v) ? (v as unknown as Prisma.InputJsonValue) : undefined;
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

  const queued = queueDeviceCommand(
    command,
    { source: "mobile", byIp: req.ip ?? "unknown" },
    sessionId ? { userId, sessionId } : undefined,
  );
  res.status(201).json({ ok: true, ...queued, sessionId: sessionId ?? null });
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

  await prisma.$transaction(async (tx) => {
    const knownQuestions = await tx.symptomQuestion.findMany({ select: { questionId: true } });
    const known = new Set(knownQuestions.map((q) => q.questionId));
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
          symptomResponses: { create: symptomCreates },
        },
      });
    }

    const recordingIds: string[] = [];
    for (const uri of audioUris) {
      const recordingId = randomUUID();
      recordingIds.push(recordingId);
      await tx.coughRecording.create({
        data: {
          recordingId,
          sessionId,
          // `file_uri` is now nullable; we keep the original phone-local path
          // here purely for diagnostics. The real audio is uploaded separately
          // via POST /screenings/:sessionId/cough-recordings so the bytes live
          // on the server and any signed-in device can play them.
          fileUri: uri,
          mimeType: inferMime(uri, "audio/wav", "image/jpeg"),
          source: "mobile",
        },
      });
    }

    const firstRecordingId = recordingIds[0];
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
        },
        orderBy: { recordedAt: "asc" },
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
  res.status(201).json({ session });
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
    where: { userId, completedAt: { not: null } },
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
        },
      },
      _count: {
        select: { coughRecordings: true, symptomResponses: true },
      },
    },
  });

  res.json({ screenings: rows });
}

export async function getMyScreening(req: AuthRequest, res: Response) {
  const userId = authenticatedUserId(req);
  const sessionId = getString(req.params.sessionId);
  if (!sessionId) throw new HttpError(400, "sessionId is required");

  const session = await prisma.screeningSession.findFirst({
    where: { sessionId, userId },
    include: {
      result: true,
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
          qualityCheck: true,
          audioPrediction: true,
        },
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
  const coughRecordings = session.coughRecordings.map((r) => ({
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
      coughRecordings,
      sputumImage,
    },
  });
}
