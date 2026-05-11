"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signAuthToken = signAuthToken;
exports.verifyAuthToken = verifyAuthToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET is required");
    }
    return secret;
}
function signAuthToken(payload) {
    const options = {
        expiresIn: (process.env.JWT_EXPIRES_IN ?? "7d"),
    };
    return jsonwebtoken_1.default.sign(payload, getJwtSecret(), options);
}
function verifyAuthToken(token) {
    const payload = jsonwebtoken_1.default.verify(token, getJwtSecret());
    if (typeof payload === "string" || typeof payload.userId !== "string") {
        throw new Error("Invalid auth token");
    }
    return {
        userId: payload.userId,
        email: typeof payload.email === "string" ? payload.email : null,
    };
}
//# sourceMappingURL=jwt.js.map