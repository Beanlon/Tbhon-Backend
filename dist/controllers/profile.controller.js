"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = getMe;
exports.updateProfile = updateProfile;
const prisma_1 = require("../prisma");
async function getMe(req, res) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { userId: req.user.userId },
        select: {
            userId: true,
            email: true,
            phoneNumber: true,
            createdAt: true,
            updatedAt: true,
            profile: true,
        },
    });
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }
    const { profile, ...safeUser } = user;
    return res.json({
        user: safeUser,
        profile,
    });
}
async function updateProfile(req, res) {
    const body = req.body;
    const profileData = {};
    if (body.firstName !== undefined)
        profileData.firstName = body.firstName.trim();
    if (body.lastName !== undefined)
        profileData.lastName = body.lastName.trim();
    if (body.gender !== undefined)
        profileData.gender = body.gender.trim();
    if (body.street !== undefined)
        profileData.street = body.street?.trim() || null;
    if (body.barangay !== undefined)
        profileData.barangay = body.barangay?.trim() || null;
    if (body.city !== undefined)
        profileData.city = body.city?.trim() || null;
    if (body.birthdate !== undefined) {
        const birthdate = new Date(body.birthdate);
        if (Number.isNaN(birthdate.getTime())) {
            return res.status(400).json({ message: "birthdate must be a valid date" });
        }
        profileData.birthdate = birthdate;
    }
    const data = {
        profile: {
            update: profileData,
        },
    };
    if (body.phoneNumber !== undefined) {
        data.phoneNumber = body.phoneNumber?.trim() || null;
    }
    const user = await prisma_1.prisma.user.update({
        where: { userId: req.user.userId },
        data,
        select: {
            userId: true,
            email: true,
            phoneNumber: true,
            createdAt: true,
            updatedAt: true,
            profile: true,
        },
    });
    const { profile, ...safeUser } = user;
    return res.json({
        user: safeUser,
        profile,
    });
}
//# sourceMappingURL=profile.controller.js.map