"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("../prisma");
const auth_1 = require("../utils/auth");
const http_1 = require("../utils/http");
const profile_1 = require("../utils/profile");
function toUserResponse(user) {
    return {
        userId: user.userId,
        email: user.email,
        phoneNumber: user.phoneNumber,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        profile: user.profile ?? null,
    };
}
async function register(req, res) {
    if (!(0, http_1.isRecord)(req.body)) {
        throw new http_1.HttpError(400, "Request body is required");
    }
    const email = (0, http_1.getString)(req.body.email)?.toLowerCase();
    const phoneNumber = (0, http_1.getString)(req.body.phoneNumber);
    const password = (0, http_1.getString)(req.body.password);
    if (!email || !password) {
        throw new http_1.HttpError(400, "email and password are required");
    }
    if (password.length < 8) {
        throw new http_1.HttpError(400, "password must be at least 8 characters");
    }
    const existingUser = await prisma_1.prisma.user.findUnique({
        where: { email },
    });
    if (existingUser) {
        throw new http_1.HttpError(409, "Email is already registered");
    }
    const passwordHash = await bcryptjs_1.default.hash(password, 12);
    const profile = req.body.profile === undefined ? undefined : (0, profile_1.parseProfileInput)(req.body.profile);
    const user = await prisma_1.prisma.user.create({
        data: {
            email,
            phoneNumber: phoneNumber ?? null,
            passwordHash,
            ...(profile ? { profile: { create: profile } } : {}),
        },
        include: {
            profile: true,
        },
    });
    const token = (0, auth_1.signAuthToken)({ userId: user.userId });
    res.status(201).json({
        token,
        user: toUserResponse(user),
    });
}
async function login(req, res) {
    if (!(0, http_1.isRecord)(req.body)) {
        throw new http_1.HttpError(400, "Request body is required");
    }
    const email = (0, http_1.getString)(req.body.email)?.toLowerCase();
    const password = (0, http_1.getString)(req.body.password);
    if (!email || !password) {
        throw new http_1.HttpError(400, "email and password are required");
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { email },
        include: {
            profile: true,
        },
    });
    if (!user) {
        throw new http_1.HttpError(401, "Invalid email or password");
    }
    const passwordMatches = await bcryptjs_1.default.compare(password, user.passwordHash);
    if (!passwordMatches) {
        throw new http_1.HttpError(401, "Invalid email or password");
    }
    const token = (0, auth_1.signAuthToken)({ userId: user.userId });
    res.json({
        token,
        user: toUserResponse(user),
    });
}
//# sourceMappingURL=auth.controller.js.map