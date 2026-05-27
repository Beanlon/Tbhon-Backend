"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireIotKey = requireIotKey;
const http_1 = require("../utils/http");
/**
 * Shared-key gate for ESP32 / microcontroller endpoints.
 *
 *  - Set `IOT_API_KEY` in the backend `.env`.
 *  - Devices send the same value as either:
 *      * `x-iot-key` header (recommended), or
 *      * `Authorization: Bearer <key>` header.
 *
 * Devices then identify *which user owns the data* by including `userId` (and
 * optionally `sessionId`) in the request body — the IoT controllers persist
 * the upload under that account so the user can see it on any phone.
 */
function requireIotKey(req, _res, next) {
    const expected = process.env.IOT_API_KEY;
    if (!expected) {
        return next(new http_1.HttpError(503, "IoT API is not configured (set IOT_API_KEY in the backend environment)"));
    }
    const provided = (req.header("x-iot-key") ?? "").trim() ||
        (req.header("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!provided || provided !== expected) {
        return next(new http_1.HttpError(401, "Invalid IoT API key"));
    }
    return next();
}
//# sourceMappingURL=iot.middleware.js.map