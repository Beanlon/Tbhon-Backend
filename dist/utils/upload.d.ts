import multer from "multer";
export declare const upload: multer.Multer;
/** Map a filename / declared mime to a safe storage mime + extension. */
export declare function normalizeAudioMime(mime: string | undefined, filename: string | undefined): {
    mimeType: string;
    ext: string;
};
export declare function normalizeImageMime(mime: string | undefined, filename: string | undefined): {
    mimeType: string;
    ext: string;
};
/**
 * Convert a Node `Buffer` into a `Uint8Array` backed by a fresh `ArrayBuffer`,
 * which is what Prisma's generated `Bytes` column type accepts. We must copy
 * because Buffer's underlying buffer may be a pooled `ArrayBufferLike` /
 * `SharedArrayBuffer`.
 */
export declare function toBytes(buf: Buffer): Uint8Array<ArrayBuffer>;
/**
 * Decode either a multer-handled multipart upload or a JSON body that carries
 * the file as `fileBase64` (preferred for microcontrollers that cannot do
 * multipart). Returns the buffer + declared mime + filename or `null` if the
 * request did not contain a usable file.
 */
export declare function readUploadedFile(req: {
    file?: {
        buffer: Buffer;
        mimetype?: string;
        originalname?: string;
    } | undefined;
    body?: Record<string, unknown>;
}): {
    buffer: Buffer;
    mimeType: string | undefined;
    filename: string | undefined;
} | null;
//# sourceMappingURL=upload.d.ts.map