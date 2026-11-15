import { redis } from "@notra/ai/utils/redis";
import { logError, logWarn } from "@notra/ai/utils/server-log";
import {
  DEMO_ORG_SLUG_PREFIX,
  DEMO_SEEDING_GRACE_MINUTES,
} from "@notra/db/constants/demo";
import { db } from "@notra/db/drizzle";
import {
  demoRequestLog,
  demoSandboxes,
  members,
  organizations,
  users,
} from "@notra/db/schema";
import type { DemoPersonalization } from "@notra/db/types/demo";
import { advisoryXactLock } from "@notra/db/utils/advisory-xact-lock";
import { normalizeTimeZone } from "@notra/utils/demo-clock";
import {
  and,
  asc,
  count,
  eq,
  gt,
  inArray,
  like,
  lt,
  notExists,
  notLike,
  sql,
  type SQL,
  TransactionRollbackError,
} from "drizzle-orm";

import {
  DEMO_ANONYMOUS_ID_LENGTH,
  DEMO_CLEANUP_BATCH_SIZE,
  DEMO_ANONYMOUS_ID_PREFIX,
  DEMO_COMPANY_NAME,
  DEMO_EVICTION_IDLE_MS,
  DEMO_MAX_ACTIVE_SANDBOXES,
  DEMO_POOL_FRESH_MS,
  DEMO_POOL_ID_PREFIX,
  DEMO_POOL_REFILL_LOCK_KEY,
  DEMO_POOL_REFILL_LOCK_SECONDS,
  DEMO_POOL_REFILL_RELEASE_SCRIPT,
  DEMO_ORG_SLUG_SUFFIX_LENGTH,
  DEMO_SANDBOX_MAX_AGE_MS,
  DEMO_SANDBOX_RESET_LOCK_PREFIX,
  DEMO_SANDBOX_RESET_LOCK_SECONDS,
  DEMO_SEED_ID_PREFIX,
  DEMO_STORAGE_LOCK_KEY,
  DEMO_TOUCH_INTERVAL_MS,
  DEMO_USER_EMAIL_DOMAIN,
  DEMO_VISITOR_EMAIL_LOCAL,
  DEMO_VISITOR_NAME,
} from "@/constants/demo";
import {
  createDemoApiKey,
  deleteDemoApiKey,
  updateDemoApiKey,
} from "@/lib/demo/api-key";
import { assertDedicatedDemoDatabase } from "@/lib/demo/database-guard";
import { rebaseDemoSandbox, shouldRebaseDemoSandbox } from "@/lib/demo/rebase";
import { seedDemoWorkspace } from "@/lib/demo/seed/workspace";
import { afterResponse } from "@/lib/framework/after-response";
import type {
  CreateDemoSandboxInput,
  DemoOrganizationInput,
  CreatedDemoSandbox,
  DemoSandbox,
  DemoTransaction,
} from "@/types/demo";
import { demoPoolSize } from "@/utils/demo-limits";

const ID_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const UNBIASED_BYTE_LIMIT = 256 - (256 % ID_ALPHABET.length);

function randomToken(length: number): string {
  let token = "";
  while (token.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length))) {
      if (byte < UNBIASED_BYTE_LIMIT && token.length < length) {
        token += ID_ALPHABET[byte % ID_ALPHABET.length];
      }
    }
  }
  return token;
}

function createAnonymousId(): string {
  return `${DEMO_ANONYMOUS_ID_PREFIX}${randomToken(DEMO_ANONYMOUS_ID_LENGTH)}`;
}

function sandboxExpiry(createdAt: Date): Date {
  return new Date(createdAt.getTime() + DEMO_SANDBOX_MAX_AGE_MS);
}

const POOLED_ID_PATTERN = `${DEMO_POOL_ID_PREFIX}%`;

async function countDemoSandboxes(
  where?: SQL,
  executor: typeof db | DemoTransaction = db
): Promise<number> {
  const [{ value } = { value: 0 }] = await executor
    .select({ value: count() })
    .from(demoSandboxes)
    .where(where);
  return value;
}

async function lockNextPooledSandbox(
  tx: DemoTransaction,
  now: Date,
  anchoredAfter?: Date
) {
  const [pooled] = await tx
    .select({
      anonymousId: demoSandboxes.anonymousId,
      organizationId: demoSandboxes.organizationId,
      userId: demoSandboxes.userId,
      apiKeyId: demoSandboxes.apiKeyId,
      anchorAt: demoSandboxes.anchorAt,
      slug: organizations.slug,
    })
    .from(demoSandboxes)
    .innerJoin(
      organizations,
      eq(organizations.id, demoSandboxes.organizationId)
    )
    .where(
      and(
        like(demoSandboxes.anonymousId, POOLED_ID_PATTERN),
        gt(demoSandboxes.expiresAt, now),
        anchoredAfter ? gt(demoSandboxes.anchorAt, anchoredAfter) : undefined
      )
    )
    .orderBy(
      sql`${demoSandboxes.anchorAt} > ${new Date(now.getTime() - DEMO_POOL_FRESH_MS)} desc`,
      asc(demoSandboxes.createdAt)
    )
    .limit(1)
    .for("update", { of: demoSandboxes, skipLocked: true });
  return pooled ?? null;
}

async function withOrganizationRollback<T>(
  organization: { organizationId: string },
  work: () => Promise<T>
): Promise<T> {
  try {
    return await work();
  } catch (error) {
    await deleteDemoOrganization(organization.organizationId);
    throw error;
  }
}

async function createDemoOrganization(input: DemoOrganizationInput) {
  const companyName = input.personalization?.companyName ?? DEMO_COMPANY_NAME;
  const visitorName = input.personalization
    ? `${input.personalization.firstName} ${input.personalization.lastName}`.trim()
    : DEMO_VISITOR_NAME;
  const organizationId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const slug = `${DEMO_ORG_SLUG_PREFIX}${randomToken(DEMO_ORG_SLUG_SUFFIX_LENGTH).toLowerCase()}`;

  const created = await db.transaction(async (tx) => {
    if (input.reservation) {
      const locked = await advisoryXactLock(tx, DEMO_STORAGE_LOCK_KEY, {
        try: true,
      });
      if (!locked) {
        logWarn("[demo] Workspace reservation lock is busy", {
          reason: "reservation_lock_busy",
        });
        return false;
      }
      const sandboxCount = await countDemoSandboxes(undefined, tx);
      if (sandboxCount >= DEMO_MAX_ACTIVE_SANDBOXES) {
        logWarn("[demo] Workspace capacity is full", {
          reason: "capacity_full",
          sandboxCount,
        });
        return false;
      }
    }
    await tx.insert(users).values({
      id: userId,
      name: visitorName,
      email: `${DEMO_VISITOR_EMAIL_LOCAL}+${organizationId.slice(0, 8)}@${DEMO_USER_EMAIL_DOMAIN}`,
      emailVerified: true,
      createdAt: input.now,
      updatedAt: input.now,
    });
    await tx.insert(organizations).values({
      id: organizationId,
      name: companyName,
      slug,
      createdAt: input.now,
      onboardingCompleted: true,
      onboardingDismissed: true,
      onboardingAgentRan: true,
    });
    await tx.insert(members).values({
      id: crypto.randomUUID(),
      organizationId,
      userId,
      role: "owner",
      createdAt: input.now,
    });
    if (input.reservation) {
      await tx.insert(demoSandboxes).values({
        anonymousId: input.reservation.anonymousId,
        organizationId,
        userId,
        timeZone: input.timeZone,
        anchorAt: input.now,
        ipHash: input.reservation.ipHash,
        createdAt: input.now,
        lastSeenAt: input.now,
        expiresAt: new Date(
          input.now.getTime() + DEMO_SEEDING_GRACE_MINUTES * 60_000
        ),
      });
    }
    return true;
  });
  if (!created) {
    return null;
  }

  await withOrganizationRollback({ organizationId }, () =>
    seedDemoWorkspace({
      organizationId,
      companyName,
      ownerUserId: userId,
      timeZone: input.timeZone,
      now: input.now,
    })
  );

  return { organizationId, userId, slug };
}

async function enforceDemoSandboxCap(reservedSlots = 1) {
  const cap = DEMO_MAX_ACTIVE_SANDBOXES - reservedSlots;
  if ((await countDemoSandboxes()) <= cap) {
    return;
  }
  await cleanupExpiredDemoSandboxes(DEMO_CLEANUP_BATCH_SIZE);
  let overflow = (await countDemoSandboxes()) - cap;
  if (overflow <= 0) {
    return;
  }
  const excessPoolSize = Math.min(
    overflow,
    Math.max(
      0,
      (await countDemoSandboxes(
        like(demoSandboxes.anonymousId, POOLED_ID_PATTERN)
      )) - demoPoolSize()
    )
  );
  if (excessPoolSize > 0) {
    const excessPool = await deleteLockedDemoSandboxes({
      where: like(demoSandboxes.anonymousId, POOLED_ID_PATTERN),
      orderBy: asc(demoSandboxes.createdAt),
      limit: excessPoolSize,
    });
    await Promise.all(excessPool.map(deleteDemoSandboxApiKey));
    overflow = (await countDemoSandboxes()) - cap;
    if (overflow <= 0 || excessPool.length < excessPoolSize) {
      return;
    }
  }
  const evicted = await deleteLockedDemoSandboxes({
    where: and(
      notLike(demoSandboxes.anonymousId, POOLED_ID_PATTERN),
      notLike(demoSandboxes.anonymousId, `${DEMO_SEED_ID_PREFIX}%`),
      lt(demoSandboxes.lastSeenAt, new Date(Date.now() - DEMO_EVICTION_IDLE_MS))
    ),
    orderBy: asc(demoSandboxes.lastSeenAt),
    limit: overflow,
  });
  await Promise.all(evicted.map(deleteDemoSandboxApiKey));
}

async function seedDemoSandbox(
  anonymousId: string,
  input: CreateDemoSandboxInput
): Promise<CreatedDemoSandbox | null> {
  const timeZone = normalizeTimeZone(input.timeZone);
  const now = new Date();
  const expiresAt = sandboxExpiry(now);
  const reservedId = `${DEMO_SEED_ID_PREFIX}${anonymousId}`;

  const organization = await createDemoOrganization({
    timeZone,
    now,
    personalization: null,
    reservation: { anonymousId: reservedId, ipHash: input.ipHash },
  });
  if (!organization) {
    return null;
  }
  const { organizationId, slug } = organization;
  const apiKey = await createDemoApiKey({
    organizationId,
    anonymousId,
    expiresAt,
  }).catch((error: unknown) => {
    logError("[demo] Failed to create sandbox API key", error);
    return null;
  });

  const ready = await withOrganizationRollback(organization, () =>
    db.transaction(async (tx) => {
      const [reservation] = await tx
        .select({ expiresAt: demoSandboxes.expiresAt })
        .from(demoSandboxes)
        .where(
          and(
            eq(demoSandboxes.anonymousId, reservedId),
            eq(demoSandboxes.organizationId, organizationId)
          )
        )
        .limit(1)
        .for("update", { of: demoSandboxes });
      if (!reservation || reservation.expiresAt.getTime() <= Date.now()) {
        return [];
      }
      return tx
        .update(demoSandboxes)
        .set({
          anonymousId,
          apiKey: apiKey?.key ?? null,
          apiKeyId: apiKey?.keyId ?? null,
          expiresAt,
        })
        .where(
          and(
            eq(demoSandboxes.anonymousId, reservedId),
            eq(demoSandboxes.organizationId, organizationId),
            gt(demoSandboxes.expiresAt, new Date())
          )
        )
        .returning({ anonymousId: demoSandboxes.anonymousId });
    })
  ).catch(async (error: unknown) => {
    await deleteDemoSandboxApiKey({ apiKeyId: apiKey?.keyId ?? null });
    throw error;
  });
  if (ready.length === 0) {
    await Promise.all([
      deleteDemoOrganization(organizationId),
      deleteDemoSandboxApiKey({ apiKeyId: apiKey?.keyId ?? null }),
    ]);
    return null;
  }

  return { anonymousId, organizationId, slug };
}

/**
 * Hands a ready, pre-seeded sandbox to a new visitor: re-keys it to a fresh
 * anonymousId and shifts its data to the present. Null when the pool is
 * empty.
 */
async function claimPooledSandbox(
  input: CreateDemoSandboxInput
): Promise<CreatedDemoSandbox | null> {
  const anonymousId = createAnonymousId();
  const now = new Date();
  const claimed = await db.transaction(async (tx) => {
    const pooled = await lockNextPooledSandbox(tx, now);
    if (!pooled) {
      return null;
    }
    const fresh =
      now.getTime() - pooled.anchorAt.getTime() < DEMO_POOL_FRESH_MS;
    await tx
      .delete(demoRequestLog)
      .where(eq(demoRequestLog.anonymousId, pooled.anonymousId));
    const [row] = await tx
      .update(demoSandboxes)
      .set({
        anonymousId,
        timeZone: normalizeTimeZone(input.timeZone),
        ipHash: input.ipHash,
        createdAt: now,
        lastSeenAt: now,
        expiresAt: sandboxExpiry(now),
        ...(fresh ? { anchorAt: now } : {}),
      })
      .where(eq(demoSandboxes.anonymousId, pooled.anonymousId))
      .returning();
    return row ? { row, slug: pooled.slug, fresh } : null;
  });
  if (!claimed) {
    return null;
  }
  if (!claimed.fresh) {
    await rebaseDemoSandbox(claimed.row, now);
  }
  const keyId = claimed.row.apiKeyId;
  if (keyId) {
    afterResponse(() =>
      updateDemoApiKey({ keyId, expiresAt: sandboxExpiry(now) }).catch(
        (error: unknown) => {
          logError("[demo] Failed to extend claimed sandbox key", error);
        }
      )
    );
  }
  return {
    anonymousId,
    organizationId: claimed.row.organizationId,
    slug: claimed.slug,
  };
}

/** A sandbox for a new visitor: from the pool when one is ready. */
export async function createDemoSandbox(
  input: CreateDemoSandboxInput
): Promise<CreatedDemoSandbox | null> {
  await assertDedicatedDemoDatabase();
  const pooled = await claimPooledSandbox(input);
  if (pooled) {
    return pooled;
  }
  await enforceDemoSandboxCap();
  return seedDemoSandbox(createAnonymousId(), input);
}

async function withDemoLock<T>(
  key: string,
  seconds: number,
  work: () => Promise<T>
): Promise<T | null> {
  const token = crypto.randomUUID();
  const locked = redis
    ? await redis.set(key, token, { nx: true, ex: seconds })
    : "OK";
  if (!locked) {
    return null;
  }
  try {
    return await work();
  } finally {
    await redis?.eval(DEMO_POOL_REFILL_RELEASE_SCRIPT, [key], [token]);
  }
}

/**
 * Clears expired sandboxes and tops the pool back up once the response is
 * sent. Piggybacks on new visitors instead of a cron: the demo shares
 * vercel.json with production, where a demo cron would only 404.
 */
export function maintainDemoSandboxPool(): void {
  afterResponse(async () => {
    await cleanupExpiredDemoSandboxes(DEMO_CLEANUP_BATCH_SIZE);
    await enforceDemoSandboxCap(0);
    await withDemoLock(
      DEMO_POOL_REFILL_LOCK_KEY,
      DEMO_POOL_REFILL_LOCK_SECONDS,
      refillPool
    );
  });
}

async function refillPool(): Promise<void> {
  const target = demoPoolSize();
  const now = new Date();
  const stale = await db.query.demoSandboxes.findMany({
    where: and(
      like(demoSandboxes.anonymousId, POOLED_ID_PATTERN),
      lt(
        demoSandboxes.anchorAt,
        new Date(now.getTime() - DEMO_POOL_FRESH_MS / 2)
      )
    ),
  });
  await Promise.all(stale.map((sandbox) => rebaseDemoSandbox(sandbox, now)));
  while (
    (await countDemoSandboxes(
      like(demoSandboxes.anonymousId, POOLED_ID_PATTERN)
    )) < target
  ) {
    await enforceDemoSandboxCap();
    const seeded = await seedDemoSandbox(
      `${DEMO_POOL_ID_PREFIX}${randomToken(DEMO_ANONYMOUS_ID_LENGTH)}`,
      { timeZone: null, ipHash: null }
    );
    if (!seeded) {
      break;
    }
  }
}

export async function loadDemoSandbox(
  anonymousId: string
): Promise<DemoSandbox | null> {
  const sandbox = await db.query.demoSandboxes.findFirst({
    where: and(
      eq(demoSandboxes.anonymousId, anonymousId),
      gt(demoSandboxes.expiresAt, new Date())
    ),
  });
  return sandbox ?? null;
}

/**
 * Records activity and keeps the data current: on the first request of a new
 * local day, shifts every timestamp forward.
 */
export async function touchDemoSandbox(
  sandbox: DemoSandbox
): Promise<DemoSandbox> {
  const now = new Date();
  let current = sandbox;

  if (shouldRebaseDemoSandbox(current, now)) {
    current = await rebaseDemoSandbox(current, now);
  }

  if (now.getTime() - current.lastSeenAt.getTime() < DEMO_TOUCH_INTERVAL_MS) {
    return current;
  }

  await db
    .update(demoSandboxes)
    .set({ lastSeenAt: now })
    .where(eq(demoSandboxes.anonymousId, current.anonymousId));
  return { ...current, lastSeenAt: now };
}

async function resetDemoSandbox(
  sandbox: DemoSandbox,
  personalization: DemoPersonalization | null = sandbox.personalization
): Promise<{ slug: string }> {
  const now = new Date();
  const swapped = personalization
    ? null
    : await swapInPooledWorkspace(sandbox, now);
  if (swapped === "conflict") {
    return { slug: await currentDemoSlug(sandbox.anonymousId) };
  }
  const next =
    swapped ?? (await seedReplacementWorkspace(sandbox, personalization, now));
  if (!next) {
    return { slug: await currentDemoSlug(sandbox.anonymousId) };
  }

  await moveDemoApiKey(sandbox, next.organizationId, now);
  await db
    .delete(demoRequestLog)
    .where(eq(demoRequestLog.anonymousId, sandbox.anonymousId));
  await deleteDemoOrganization(sandbox.organizationId);

  return { slug: next.slug };
}

/**
 * `resetDemoSandbox`, but "busy" while another reset of the same sandbox is
 * still running: each one seeds a whole workspace next to the old one, so
 * parallel resets would multiply storage beyond what the cap accounts for.
 */
export async function resetDemoSandboxExclusive(
  sandbox: DemoSandbox,
  personalization?: DemoPersonalization | null
): Promise<{ slug: string } | "busy"> {
  const result = await withDemoLock(
    `${DEMO_SANDBOX_RESET_LOCK_PREFIX}${sandbox.anonymousId}`,
    DEMO_SANDBOX_RESET_LOCK_SECONDS,
    () => resetDemoSandbox(sandbox, personalization)
  );
  return result ?? "busy";
}

async function swapInPooledWorkspace(
  sandbox: DemoSandbox,
  now: Date
): Promise<{ organizationId: string; slug: string } | "conflict" | null> {
  const result = await db
    .transaction(async (tx) => {
      const pooled = await lockNextPooledSandbox(
        tx,
        now,
        new Date(now.getTime() - DEMO_POOL_FRESH_MS)
      );
      if (!pooled) {
        return null;
      }
      await tx
        .delete(demoSandboxes)
        .where(eq(demoSandboxes.anonymousId, pooled.anonymousId));
      const moved = await tx
        .update(demoSandboxes)
        .set({
          organizationId: pooled.organizationId,
          userId: pooled.userId,
          anchorAt: now,
          personalization: null,
          lastSeenAt: now,
        })
        .where(
          and(
            eq(demoSandboxes.anonymousId, sandbox.anonymousId),
            eq(demoSandboxes.organizationId, sandbox.organizationId)
          )
        )
        .returning({ anonymousId: demoSandboxes.anonymousId });
      if (moved.length === 0) {
        tx.rollback();
      }
      return pooled;
    })
    .catch((error: unknown) => {
      if (error instanceof TransactionRollbackError) {
        return "conflict" as const;
      }
      throw error;
    });
  if (result === null || result === "conflict") {
    return result;
  }
  const pooledKeyId = result.apiKeyId;
  if (pooledKeyId) {
    afterResponse(() =>
      deleteDemoApiKey(pooledKeyId).catch((error: unknown) => {
        logError("[demo] Failed to delete pooled sandbox key", error);
      })
    );
  }
  return { organizationId: result.organizationId, slug: result.slug };
}

async function seedReplacementWorkspace(
  sandbox: DemoSandbox,
  personalization: DemoPersonalization | null,
  now: Date
): Promise<{ organizationId: string; slug: string } | null> {
  const next = await createDemoOrganization({
    timeZone: sandbox.timeZone,
    now,
    personalization,
  });
  if (!next) {
    return null;
  }
  const claimed = await withOrganizationRollback(next, () =>
    db
      .update(demoSandboxes)
      .set({
        organizationId: next.organizationId,
        userId: next.userId,
        anchorAt: now,
        personalization,
        lastSeenAt: now,
      })
      .where(
        and(
          eq(demoSandboxes.anonymousId, sandbox.anonymousId),
          eq(demoSandboxes.organizationId, sandbox.organizationId)
        )
      )
      .returning({ anonymousId: demoSandboxes.anonymousId })
  );
  if (claimed.length === 0) {
    await deleteDemoOrganization(next.organizationId);
    return null;
  }
  return { organizationId: next.organizationId, slug: next.slug };
}

async function currentDemoSlug(anonymousId: string): Promise<string> {
  const [row] = await db
    .select({ slug: organizations.slug })
    .from(demoSandboxes)
    .innerJoin(
      organizations,
      eq(organizations.id, demoSandboxes.organizationId)
    )
    .where(eq(demoSandboxes.anonymousId, anonymousId));
  if (!row) {
    throw new Error("Demo sandbox disappeared during reset");
  }
  return row.slug;
}

async function moveDemoApiKey(
  sandbox: DemoSandbox,
  organizationId: string,
  now: Date
) {
  if (sandbox.apiKeyId) {
    const moved = await updateDemoApiKey({
      keyId: sandbox.apiKeyId,
      organizationId,
    }).then(
      () => true,
      (error: unknown) => {
        logError("[demo] Failed to move sandbox API key", error);
        return false;
      }
    );
    if (moved) {
      return;
    }
    await deleteDemoApiKey(sandbox.apiKeyId).catch(() => undefined);
  }
  const replacement = await createDemoApiKey({
    organizationId,
    anonymousId: sandbox.anonymousId,
    expiresAt: sandboxExpiry(sandbox.createdAt),
  }).catch((error: unknown) => {
    logError("[demo] Failed to replace sandbox API key", error);
    return null;
  });
  await db
    .update(demoSandboxes)
    .set({
      apiKey: replacement?.key ?? null,
      apiKeyId: replacement?.keyId ?? null,
      lastSeenAt: now,
    })
    .where(eq(demoSandboxes.anonymousId, sandbox.anonymousId));
}

async function deleteDemoOrganization(
  organizationId: string,
  executor: typeof db | DemoTransaction = db
) {
  const memberRows = await executor
    .select({ userId: members.userId })
    .from(members)
    .where(eq(members.organizationId, organizationId));
  await executor
    .delete(organizations)
    .where(eq(organizations.id, organizationId));
  const userIds = memberRows.map((row) => row.userId);
  if (userIds.length > 0) {
    await executor.delete(users).where(inArray(users.id, userIds));
  }
}

function deleteLockedDemoSandboxes(query: {
  where: SQL | undefined;
  orderBy: SQL;
  limit: number;
}) {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(demoSandboxes)
      .where(query.where)
      .orderBy(query.orderBy)
      .limit(query.limit)
      .for("update", { of: demoSandboxes, skipLocked: true });
    for (const sandbox of rows) {
      await deleteDemoOrganization(sandbox.organizationId, tx);
    }
    return rows;
  });
}

async function deleteDemoSandboxApiKey(sandbox: Pick<DemoSandbox, "apiKeyId">) {
  if (sandbox.apiKeyId) {
    await deleteDemoApiKey(sandbox.apiKeyId).catch((error: unknown) => {
      logError("[demo] Failed to delete sandbox API key", error);
    });
  }
}

async function cleanupOrphanedDemoOrganizations(limit: number, now: Date) {
  const orphans = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(
      and(
        like(organizations.slug, `${DEMO_ORG_SLUG_PREFIX}%`),
        lt(
          organizations.createdAt,
          new Date(now.getTime() - DEMO_SEEDING_GRACE_MINUTES * 60_000)
        ),
        notExists(
          db
            .select({ id: demoSandboxes.anonymousId })
            .from(demoSandboxes)
            .where(eq(demoSandboxes.organizationId, organizations.id))
        )
      )
    )
    .limit(limit);
  await Promise.all(orphans.map((org) => deleteDemoOrganization(org.id)));
  return orphans.length;
}

async function cleanupExpiredDemoSandboxes(limit: number): Promise<number> {
  const now = new Date();
  const expired = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(demoSandboxes)
      .where(lt(demoSandboxes.expiresAt, now))
      .limit(limit)
      .for("update", { of: demoSandboxes, skipLocked: true });
    for (const sandbox of rows) {
      await deleteDemoOrganization(sandbox.organizationId, tx);
    }
    return rows;
  });

  const [, orphaned] = await Promise.all([
    Promise.all(expired.map(deleteDemoSandboxApiKey)),
    cleanupOrphanedDemoOrganizations(limit, now),
  ]);

  return expired.length + orphaned;
}
