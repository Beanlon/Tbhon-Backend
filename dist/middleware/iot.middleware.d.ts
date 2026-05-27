import type { NextFunction, Request, Response } from "express";
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
export declare function requireIotKey(req: Request, _res: Response, next: NextFunction): void;
//# sourceMappingURL=iot.middleware.d.ts.map