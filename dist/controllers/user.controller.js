"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = getMe;
exports.updateMe = updateMe;
exports.upsertMyProfile = upsertMyProfile;
const prisma_1 = require("../prisma");
const http_1 = require("../utils/http");
const profile_1 = require("../utils/profile");
function getAuthenticatedUserId(req) {
    const userId = req.user?.userId;
    if (!userId) {
        throw new http_1.HttpError(401, "Authentication is required");
    }
    return userId;
}
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
async function getMe(req, res) {
    const userId = getAuthenticatedUserId(req);
    const user = await prisma_1.prisma.user.findUnique({
        where: { userId },
        include: {
            profile: true,
        },
    });
    if (!user) {
        throw new http_1.HttpError(404, "User not found");
    }
    res.json({ user: toUserResponse(user) });
}
async function updateMe(req, res) {
    const userId = getAuthenticatedUserId(req);
    if (!(0, http_1.isRecord)(req.body)) {
        throw new http_1.HttpError(400, "Request body is required");
    }
    const email = (0, http_1.getString)(req.body.email)?.toLowerCase();
    const phoneNumber = (0, http_1.getString)(req.body.phoneNumber);
    if (!email && !phoneNumber) {
        throw new http_1.HttpError(400, "email or phoneNumber is required");
    }
    if (email) {
        const existingUser = await prisma_1.prisma.user.findUnique({
            where: { email },
        });
        if (existingUser && existingUser.userId !== userId) {
            throw new http_1.HttpError(409, "Email is already registered");
        }
    }
    const user = await prisma_1.prisma.user.update({
        where: { userId },
        data: {
            ...(email ? { email } : {}),
            ...(phoneNumber ? { phoneNumber } : {}),
        },
        include: {
            profile: true,
        },
    });
    res.json({ user: toUserResponse(user) });
}
async function upsertMyProfile(req, res) {
    const userId = getAuthenticatedUserId(req);
    const profile = (0, profile_1.parseProfileInput)(req.body);
    const updatedProfile = await prisma_1.prisma.userProfile.upsert({
        where: { userId },
        create: {
            userId,
            ...profile,
        },
        update: profile,
    });
    res.json({ profile: updatedProfile });
}
//# sourceMappingURL=user.controller.js.map