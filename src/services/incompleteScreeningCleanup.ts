import { prisma } from "../prisma";

/** Session reached the results screen when it has a persisted risk result row. */
export function incompleteSessionWhere(
  exceptSessionId?: string,
  olderThan?: Date,
) {
  return {
    result: null,
    ...(exceptSessionId ? { sessionId: { not: exceptSessionId } } : {}),
    ...(olderThan ? { startedAt: { lt: olderThan } } : {}),
  };
}

export type DeleteIncompleteResult = {
  deletedSessionIds: string[];
  count: number;
};

/**
 * Delete one incomplete session and all related rows (cascade: cough, sputum, symptoms).
 * No-op if the session has a screening_results row (user saw risk on results page).
 */
export async function deleteIncompleteScreeningBySessionId(args: {
  sessionId: string;
  userId?: string;
}): Promise<DeleteIncompleteResult> {
  const sessionId = args.sessionId.trim();
  if (!sessionId) return { deletedSessionIds: [], count: 0 };

  const row = await prisma.screeningSession.findFirst({
    where: {
      sessionId,
      ...(args.userId ? { userId: args.userId } : {}),
    },
    select: { sessionId: true, result: { select: { resultId: true } } },
  });

  if (!row || row.result) {
    return { deletedSessionIds: [], count: 0 };
  }

  await prisma.screeningSession.delete({ where: { sessionId } });
  return { deletedSessionIds: [sessionId], count: 1 };
}

/**
 * Remove all draft / abandoned screenings for a user (no results page yet).
 */
export async function deleteIncompleteScreeningsForUser(args: {
  userId: string;
  exceptSessionId?: string;
  /** Only delete drafts started before this moment (avoids removing an in-progress session). */
  olderThan?: Date;
}): Promise<DeleteIncompleteResult> {
  const userId = args.userId.trim();
  if (!userId) return { deletedSessionIds: [], count: 0 };

  const stale = await prisma.screeningSession.findMany({
    where: { userId, ...incompleteSessionWhere(args.exceptSessionId, args.olderThan) },
    select: { sessionId: true },
  });

  if (stale.length === 0) {
    return { deletedSessionIds: [], count: 0 };
  }

  const ids = stale.map((s) => s.sessionId);
  await prisma.screeningSession.deleteMany({
    where: { sessionId: { in: ids } },
  });

  return { deletedSessionIds: ids, count: ids.length };
}

/**
 * Purge incomplete sessions older than TTL (all users). Completed sessions are never touched.
 */
export async function purgeStaleIncompleteScreenings(args?: {
  maxAgeHours?: number;
}): Promise<DeleteIncompleteResult> {
  const hours = args?.maxAgeHours ?? Number(process.env.INCOMPLETE_SCREENING_TTL_HOURS ?? "24");
  const maxAgeMs = Math.max(1, hours) * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - maxAgeMs);

  const stale = await prisma.screeningSession.findMany({
    where: incompleteSessionWhere(undefined, cutoff),
    select: { sessionId: true },
  });

  if (stale.length === 0) {
    return { deletedSessionIds: [], count: 0 };
  }

  const ids = stale.map((s) => s.sessionId);
  await prisma.screeningSession.deleteMany({
    where: { sessionId: { in: ids } },
  });

  if (ids.length > 0) {
    console.log(
      `[Cleanup] Purged ${ids.length} incomplete screening session(s) started before ${cutoff.toISOString()}`,
    );
  }

  return { deletedSessionIds: ids, count: ids.length };
}

/** Background interval (optional). */
export function startIncompleteScreeningCleanupScheduler(): void {
  const enabled = process.env.ENABLE_INCOMPLETE_SCREENING_CLEANUP !== "false";
  if (!enabled) return;

  const intervalMinutes = Math.max(
    5,
    Number(process.env.INCOMPLETE_SCREENING_CLEANUP_INTERVAL_MINUTES ?? "60") || 60,
  );
  const intervalMs = intervalMinutes * 60 * 1000;

  const run = () => {
    void purgeStaleIncompleteScreenings().catch((err) => {
      console.error("[Cleanup] Incomplete screening purge failed:", err);
    });
  };

  run();
  setInterval(run, intervalMs);
  console.log(
    `[Cleanup] Incomplete screening purge every ${intervalMinutes} min (TTL ${process.env.INCOMPLETE_SCREENING_TTL_HOURS ?? "24"}h)`,
  );
}
