"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthenticatedUserId = getAuthenticatedUserId;
exports.requireAuth = requireAuth;
const http_1 = require("../utils/http");
const auth_1 = require("../utils/auth");
/** Read userId set by `requireAuth`; use in controllers after the middleware. */
function getAuthenticatedUserId(req) {
    const userId = req.user?.userId;
    if (!userId) {
        throw new http_1.HttpError(401, "Authorization token is required");
    }
    return userId;
}
function requireAuth(req, _res, next) {
    const header = req.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : undefined;
    if (!token) {
        return next(new http_1.HttpError(401, "Authorization token is required"));
    }
    try {
        const payload = (0, auth_1.verifyAuthToken)(token);
        req.user = { userId: payload.userId };
        return next();
    }
    catch {
        return next(new http_1.HttpError(401, "Invalid or expired token"));
    }
}
//# sourceMappingURL=auth.middleware.js.map