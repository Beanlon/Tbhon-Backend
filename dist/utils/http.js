"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpError = void 0;
exports.isRecord = isRecord;
exports.getString = getString;
class HttpError extends Error {
    statusCode;
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
    }
}
exports.HttpError = HttpError;
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function getString(value) {
    return typeof value === "string" ? value.trim() : undefined;
}
//# sourceMappingURL=http.js.map