"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const http_1 = require("../utils/http");
const auth_1 = require("../utils/auth");
function requireAuth(req, _res, next) {
    const header = req.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
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