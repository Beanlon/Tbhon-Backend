import type { UserProfile } from "@prisma/client";
/** User fields returned to clients (matches `users` + optional profile). */
export type UserForResponse = {
    userId: string;
    email: string | null;
    phoneNumber: string | null;
    emailVerified: boolean;
    emailVerifiedAt: Date | null;
    emailVerificationCodeHash: string | null;
    emailVerificationExpiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    profile?: UserProfile | null;
};
export type PublicUserResponse = {
    userId: string;
    email: string | null;
    phoneNumber: string | null;
    emailVerified: boolean;
    emailVerifiedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    profile: UserProfile | null;
};
/** Map a Prisma user row to API shape (use when IDE/client types lag after schema changes). */
export declare function asUserForResponse<T>(user: T): UserForResponse;
export declare function toUserResponse(user: UserForResponse): PublicUserResponse;
//# sourceMappingURL=userResponse.d.ts.map