import { randomUUID } from "crypto";
import { prisma } from "../prisma";
import { HttpError } from "./http";
import { toBytes } from "./upload";

export type PrismaTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type PrismaDb = PrismaTransaction | typeof prisma;

/** Maximum cough slots per screening session (1st, 2nd, 3rd). */
export const MAX_COUGH_ATTEMPTS = 3;

/**
 * Parse a 1-based cough slot (1–3). Returns null if missing or invalid.
 * Legacy firmware may omit coughAttempt entirely.
 */
export function parseCoughAttempt(raw: unknown): number | null {
  let n: number | null = null;
  if (typeof raw === "number" && Number.isInteger(raw)) {
    n = raw;
  } else if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    n = parseInt(raw.trim(), 10);
  }
  if (n === null || n < 1 || n > MAX_COUGH_ATTEMPTS) return null;
  return n;
}

/**
 * Parse coughAttempt when the client sent a value; reject out-of-range slots.
 */
export function parseCoughAttemptStrict(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = parseCoughAttempt(raw);
  if (n === null) {
    throw new HttpError(400, `coughAttempt must be an integer from 1 to ${MAX_COUGH_ATTEMPTS}`);
  }
  return n;
}

type UpsertCoughPayload = {
  fileUri: string | null;
  mimeType: string;
  rawData: Buffer;
  byteSize: number;
  source: string;
};

/**
 * One row per (sessionId, coughAttempt). Retakes update the same recordingId
 * and replace raw bytes so the session never grows past 3 cough rows.
 */
export async function upsertSessionCoughRecording(
  sessionId: string,
  coughAttempt: number,
  payload: UpsertCoughPayload,
  db: PrismaDb = prisma,
): Promise<string> {
  if (coughAttempt < 1 || coughAttempt > MAX_COUGH_ATTEMPTS) {
    throw new HttpError(400, `coughAttempt must be from 1 to ${MAX_COUGH_ATTEMPTS}`);
  }

  const hasBytes = payload.byteSize > 0;

  const existing = await db.coughRecording.findFirst({
    where: { sessionId, coughAttempt },
    select: { recordingId: true },
  });

  if (existing) {
    if (hasBytes) {
      await db.coughQualityCheck.deleteMany({ where: { recordingId: existing.recordingId } });
      await db.tbAudioPrediction.deleteMany({ where: { recordingId: existing.recordingId } });
    }
    if (hasBytes) {
      await db.coughRecording.update({
        where: { recordingId: existing.recordingId },
        data: {
          fileUri: payload.fileUri,
          mimeType: payload.mimeType,
          rawData: toBytes(payload.rawData),
          byteSize: payload.byteSize,
          source: payload.source,
          recordedAt: new Date(),
        },
      });
    } else {
      await db.coughRecording.update({
        where: { recordingId: existing.recordingId },
        data: {
          fileUri: payload.fileUri,
          mimeType: payload.mimeType,
        },
      });
    }
    return existing.recordingId;
  }

  const recordingId = randomUUID();
  await db.coughRecording.create({
    data: {
      recordingId,
      sessionId,
      coughAttempt,
      fileUri: payload.fileUri,
      mimeType: payload.mimeType,
      ...(hasBytes
        ? {
            rawData: toBytes(payload.rawData),
            byteSize: payload.byteSize,
            source: payload.source,
          }
        : { rawData: null, byteSize: null, source: payload.source }),
    },
  });
  return recordingId;
}
