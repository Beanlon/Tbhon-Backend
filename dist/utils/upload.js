"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = void 0;
exports.normalizeAudioMime = normalizeAudioMime;
exports.normalizeImageMime = normalizeImageMime;
exports.toBytes = toBytes;
exports.readUploadedFile = readUploadedFile;
const multer_1 = __importDefault(require("multer"));
/**
 * In-memory uploads keep the raw file bytes in `req.file.buffer`, which we can
 * write straight into MySQL `LONGBLOB` columns. Limits guard against accidental
 * memory pressure when devices or microcontrollers stream large recordings.
 */
const MAX_BYTES = 30 * 1024 * 1024; // 30 MB
exports.upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: MAX_BYTES, files: 1 },
});
/** Map a filename / declared mime to a safe storage mime + extension. */
function normalizeAudioMime(mime, filename) {
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
function normalizeImageMime(mime, filename) {
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
function toBytes(buf) {
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
function readUploadedFile(req) {
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
        }
        catch {
            // fallthrough → null
        }
    }
    return null;
}
//# sourceMappingURL=upload.js.map