"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signAuthToken = signAuthToken;
exports.verifyAuthToken = verifyAuthToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const jwtExpiresIn = (process.env.JWT_EXPIRES_IN ?? "7d");
function getJwtSecret() {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        throw new Error("JWT_SECRET is required");
    }
    return jwtSecret;
}
function signAuthToken(payload) {
    return jsonwebtoken_1.default.sign(payload, getJwtSecret(), {
        expiresIn: jwtExpiresIn,
    });
}
function verifyAuthToken(token) {
    const payload = jsonwebtoken_1.default.verify(token, getJwtSecret());
    if (typeof payload === "string" || !payload || typeof payload !== "object") {
        throw new Error("Invalid auth token");
    }
    const userId = payload.userId;
    if (typeof userId !== "string" || !userId.trim()) {
        throw new Error("Invalid auth token");
    }
    return { userId };
}
//# sourceMappingURL=auth.js.map