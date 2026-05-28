/**
 * JSON values accepted by Prisma JSON columns.
 * Defined locally so tooling works even when `@prisma/client` namespace types
 * are not yet generated (run `npx prisma generate` after schema changes).
 */
export type InputJsonValue =
  | string
  | number
  | boolean
  | InputJsonValue[]
  | { readonly [key: string]: InputJsonValue | null };
