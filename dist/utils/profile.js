"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseProfileInput = parseProfileInput;
const http_1 = require("./http");
function parseProfileInput(value) {
    if (!(0, http_1.isRecord)(value)) {
        throw new http_1.HttpError(400, "Profile payload is required");
    }
    const firstName = (0, http_1.getString)(value.firstName);
    const lastName = (0, http_1.getString)(value.lastName);
    const birthdateValue = (0, http_1.getString)(value.birthdate);
    const gender = (0, http_1.getString)(value.gender);
    if (!firstName || !lastName || !birthdateValue || !gender) {
        throw new http_1.HttpError(400, "firstName, lastName, birthdate, and gender are required");
    }
    const birthdate = new Date(birthdateValue);
    if (Number.isNaN(birthdate.getTime())) {
        throw new http_1.HttpError(400, "birthdate must be a valid date");
    }
    return {
        firstName,
        lastName,
        birthdate,
        gender,
        street: (0, http_1.getString)(value.street) ?? null,
        barangay: (0, http_1.getString)(value.barangay) ?? null,
        city: (0, http_1.getString)(value.city) ?? null,
    };
}
//# sourceMappingURL=profile.js.map