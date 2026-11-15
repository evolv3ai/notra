import { logWarn } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { members } from "@notra/db/schema";
import { isPgUniqueViolation } from "@notra/db/utils/pg-errors";
import { and, eq, sql } from "drizzle-orm";

import { MEMBERSHIP_CONFLICT_TARGET_RETRY_MS } from "@/constants/auth/membership";
import type { MembershipUpsertInput } from "@/types/auth/membership";

/** Postgres `invalid_column_reference`: no unique index matches ON CONFLICT. */
const MISSING_CONFLICT_TARGET_CODE = "42P10";

let conflictTargetRetryAt = 0;

function hasPostgresErrorCode(error: unknown, code: string): boolean {
  let current: unknown = error;
  while (current && typeof current === "object") {
    if ("code" in current && (current as { code?: unknown }).code === code) {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

async function withMembershipAdvisoryLock<T>(
  input: MembershipUpsertInput,
  run: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>
): Promise<T> {
  return db.transaction(
    async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${input.organizationId}), hashtext(${input.userId}))`
      );
      return run(tx);
    },
    { isolationLevel: "read committed" }
  );
}

async function upsertMembershipAtomically(
  input: MembershipUpsertInput
): Promise<void> {
  await withMembershipAdvisoryLock(input, async (tx) => {
    await tx
      .insert(members)
      .values({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        userId: input.userId,
        role: input.role,
        createdAt: input.createdAt,
      })
      .onConflictDoUpdate({
        target: [members.organizationId, members.userId],
        set: {
          role: sql`CASE WHEN ${members.role} = 'owner' THEN ${members.role} ELSE excluded.role END`,
        },
        setWhere: sql`${members.role} <> 'owner' AND ${members.role} <> excluded.role`,
      });
  });
}

async function updateMembershipRoleIfNeeded(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: MembershipUpsertInput,
  existing: { id: string; role: string }
): Promise<void> {
  if (existing.role !== input.role && existing.role !== "owner") {
    await tx
      .update(members)
      .set({ role: input.role })
      .where(eq(members.id, existing.id));
  }
}

async function upsertMembershipReadThenWrite(
  input: MembershipUpsertInput
): Promise<void> {
  await withMembershipAdvisoryLock(input, async (tx) => {
    const existing = await tx.query.members.findFirst({
      where: and(
        eq(members.userId, input.userId),
        eq(members.organizationId, input.organizationId)
      ),
      columns: { id: true, role: true },
    });

    if (!existing) {
      await tx.execute(sql`SAVEPOINT membership_insert`);
      try {
        await tx.insert(members).values({
          id: crypto.randomUUID(),
          organizationId: input.organizationId,
          userId: input.userId,
          role: input.role,
          createdAt: input.createdAt,
        });
        await tx.execute(sql`RELEASE SAVEPOINT membership_insert`);
      } catch (error) {
        await tx.execute(sql`ROLLBACK TO SAVEPOINT membership_insert`);
        if (!isPgUniqueViolation(error)) {
          throw error;
        }
        const raced = await tx.query.members.findFirst({
          where: and(
            eq(members.userId, input.userId),
            eq(members.organizationId, input.organizationId)
          ),
          columns: { id: true, role: true },
        });
        if (raced) {
          await updateMembershipRoleIfNeeded(tx, input, raced);
        }
      }
      return;
    }

    await updateMembershipRoleIfNeeded(tx, input, existing);
  });
}

export async function upsertMembership(
  input: MembershipUpsertInput
): Promise<void> {
  if (Date.now() < conflictTargetRetryAt) {
    await upsertMembershipReadThenWrite(input);
    return;
  }

  try {
    await upsertMembershipAtomically(input);
    conflictTargetRetryAt = 0;
  } catch (error) {
    if (!hasPostgresErrorCode(error, MISSING_CONFLICT_TARGET_CODE)) {
      throw error;
    }
    conflictTargetRetryAt = Date.now() + MEMBERSHIP_CONFLICT_TARGET_RETRY_MS;
    logWarn(
      "[auth] members(organization_id, user_id) unique index missing; apply migration 0085. Falling back to read-then-write membership sync."
    );
    await upsertMembershipReadThenWrite(input);
  }
}
