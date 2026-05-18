"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asUserForResponse = asUserForResponse;
exports.toUserResponse = toUserResponse;
/** Map a Prisma user row to API shape (use when IDE/client types lag after schema changes). */
function asUserForResponse(user) {
    return user;
}
function toUserResponse(user) {
    return {
        userId: user.userId,
        email: user.email,
        phoneNumber: user.phoneNumber,
        emailVerified: user.emailVerified,
        emailVerifiedAt: user.emailVerifiedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        profile: user.profile ?? null,
    };
}
//# sourceMappingURL=userResponse.js.map