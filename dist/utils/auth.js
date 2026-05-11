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
    return jsonwebtoken_1.default.verify(token, getJwtSecret());
}
//# sourceMappingURL=auth.js.map