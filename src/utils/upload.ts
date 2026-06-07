import type { RequestHandler } from "express";
import multer from "multer";
import { HttpError } from "./http";

/**
 * In-memory uploads keep the raw file bytes in `req.file.buffer`, which we can
 * write straight into MySQL `LONGBLOB` columns. Limits guard against accidental
 * memory pressure when devices or microcontrollers stream large recordings.
 */
const MAX_BYTES = 30 * 1024 * 1024; // 30 MB

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
});

/** True when the client (ESP32 / phone) closed the TCP socket mid-upload. */
export function isUploadClientDisconnect(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string; storageErrors?: unknown[] };
  if (e.code === "ECONNRESET" || e.code === "EPIPE" || e.code === "ERR_STREAM_PREMATURE_CLOSE") {
    return true;
  }
  const msg = typeof e.message === "string" ? e.message : "";
  if (/aborted|socket hang up|premature close/i.test(msg)) return true;
  // Multer/busboy stream errors when the device drops the connection early.
  if (Array.isArray(e.storageErrors)) return true;
  return false;
}

/** Multer middleware that maps client disconnects to 408 instead of crashing the log. */
export function uploadSingle(fieldName: string): RequestHandler {
  const handler = upload.single(fieldName);
  return (req, res, next) => {
    handler(req, res, (err) => {
      if (!err) {
        next();
        return;
      }
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          next(new HttpError(413, `File exceeds ${MAX_BYTES} byte limit`));
          return;
        }
        next(new HttpError(400, err.message));
        return;
      }
      if (isUploadClientDisconnect(err)) {
        console.warn("[upload] Client disconnected before upload finished");
        if (!res.headersSent) {
          res.status(408).json({ message: "Upload interrupted" });
        }
        return;
      }
      next(err);
    });
  };
}

/** Map a filename / declared mime to a safe storage mime + extension. */
export function normalizeAudioMime(mime: string | undefined, filename: string | undefined): {
  mimeType: string;
  ext: string;
} {
  const lowerName = (filename ?? "").toLowerCase();
  const lowerMime = (mime ?? "").toLowerCase();

  if (lowerName.endsWith(".m4a") || lowerMime.includes("mp4") || lowerMime === "audio/aac") {
    return { mimeType: "audio/mp4", ext: "m4a" };
  }
  if (lowerName.endsWith(".3gp") || lowerMime.includes("3gpp")) {
    return { mimeType: "audio/3gpp", ext: "3gp" };
  }
  if (lowerName.endsWith(".caf") || lowerMime.includes("x-caf")) {
    return { mimeType: "audio/x-caf", ext: "caf" };
  }
  if (lowerName.endsWith(".ogg") || lowerName.endsWith(".opus") || lowerMime.includes("ogg")) {
    return { mimeType: "audio/ogg", ext: "ogg" };
  }
  if (lowerName.endsWith(".mp3") || lowerMime.includes("mpeg")) {
    return { mimeType: "audio/mpeg", ext: "mp3" };
  }
  return { mimeType: "audio/wav", ext: "wav" };
}

export function normalizeImageMime(mime: string | undefined, filename: string | undefined): {
  mimeType: string;
  ext: string;
} {
  const lowerName = (filename ?? "").toLowerCase();
  const lowerMime = (mime ?? "").toLowerCase();

  if (lowerName.endsWith(".png") || lowerMime.includes("png")) {
    return { mimeType: "image/png", ext: "png" };
  }
  if (lowerName.endsWith(".webp") || lowerMime.includes("webp")) {
    return { mimeType: "image/webp", ext: "webp" };
  }
  if (lowerName.endsWith(".heic") || lowerName.endsWith(".heif") || lowerMime.includes("heic") || lowerMime.includes("heif")) {
    return { mimeType: "image/heic", ext: "heic" };
  }
  return { mimeType: "image/jpeg", ext: "jpg" };
}

/**
 * Convert a Node `Buffer` into a `Uint8Array` backed by a fresh `ArrayBuffer`,
 * which is what Prisma's generated `Bytes` column type accepts. We must copy
 * because Buffer's underlying buffer may be a pooled `ArrayBufferLike` /
 * `SharedArrayBuffer`.
 */
export function toBytes(buf: Buffer): Uint8Array<ArrayBuffer> {
  const ab = new ArrayBuffer(buf.byteLength);
  const out = new Uint8Array(ab);
  out.set(buf);
  return out;
}

/**
 * Decode either a multer-handled multipart upload or a JSON body that carries
 * the file as `fileBase64` (preferred for microcontrollers that cannot do
 * multipart). Returns the buffer + declared mime + filename or `null` if the
 * request did not contain a usable file.
 */
export function readUploadedFile(req: {
  file?: { buffer: Buffer; mimetype?: string; originalname?: string } | undefined;
  body?: Record<string, unknown>;
}): { buffer: Buffer; mimeType: string | undefined; filename: string | undefined } | null {
  const file = req.file;
  if (file && file.buffer && file.buffer.length > 0) {
    return {
      buffer: file.buffer,
      mimeType: file.mimetype,
      filename: file.originalname,
    };
  }

  const body = req.body ?? {};
  const b64 = typeof body.fileBase64 === "string" ? body.fileBase64 : undefined;
  if (b64 && b64.length > 0) {
    let cleaned = b64.trim();
    const commaIdx = cleaned.indexOf(",");
    if (cleaned.startsWith("data:") && commaIdx > 0) {
      cleaned = cleaned.slice(commaIdx + 1);
    }
    try {
      const buf = Buffer.from(cleaned, "base64");
      if (buf.length > 0) {
        return {
          buffer: buf,
          mimeType: typeof body.mimeType === "string" ? body.mimeType : undefined,
          filename: typeof body.filename === "string" ? body.filename : undefined,
        };
      }
    } catch {
      // fallthrough → null
    }
  }
  return null;
}
