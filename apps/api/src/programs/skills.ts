import { ensureSystemSkillRegistry } from "@notra/ai/skills/registry";
import { skills } from "@notra/db/schema";
import { isPgUniqueViolation } from "@notra/db/utils/pg-errors";
import { and, asc, eq, getTableColumns } from "drizzle-orm";
import { DateTime, Effect } from "effect";
import { nanoid } from "nanoid";

import {
  SkillDatabaseError,
  SkillDuplicateError,
  SkillNotFoundError,
  SystemSkillDeleteError,
  SystemSkillRenameError,
} from "../errors/skills";
import type {
  CreateSkillProgramInput,
  NamedSkillProgramInput,
  PatchSkillProgramInput,
  SkillProgramInput,
} from "../types/skills";

const { systemSkillId, systemSkillVersion, ...publicSkillColumns } =
  getTableColumns(skills);

const database = <A>(operation: () => Promise<A>) =>
  Effect.tryPromise({
    try: operation,
    catch: (cause) => new SkillDatabaseError({ cause }),
  });

const ensureRegistry = () => database(() => ensureSystemSkillRegistry());

const write = <A>(name: string, operation: () => Promise<A>) =>
  Effect.tryPromise({
    try: operation,
    catch: (cause) =>
      isPgUniqueViolation(cause)
        ? new SkillDuplicateError({ name })
        : new SkillDatabaseError({ cause }),
  });

export const listSkills = Effect.fn("skills.list")(function* ({
  db,
  organizationId,
}: SkillProgramInput) {
  yield* ensureRegistry();
  return yield* database(() =>
    db
      .select({
        id: skills.id,
        name: skills.name,
        description: skills.description,
        isSystem: skills.isSystem,
        updatedAt: skills.updatedAt,
      })
      .from(skills)
      .where(eq(skills.organizationId, organizationId))
      .orderBy(asc(skills.name))
  );
});

export const getSkill = Effect.fn("skills.get")(function* ({
  db,
  organizationId,
  name,
}: NamedSkillProgramInput) {
  yield* ensureRegistry();
  const skill = yield* database(() =>
    db.query.skills.findFirst({
      where: and(
        eq(skills.organizationId, organizationId),
        eq(skills.name, name)
      ),
      columns: { systemSkillId: false, systemSkillVersion: false },
    })
  );
  if (!skill) {
    return yield* new SkillNotFoundError();
  }
  return skill;
});

export const createSkill = Effect.fn("skills.create")(function* ({
  db,
  organizationId,
  body,
}: CreateSkillProgramInput) {
  const [created] = yield* write(body.name, () =>
    db
      .insert(skills)
      .values({
        id: nanoid(),
        organizationId,
        name: body.name,
        description: body.description,
        content: body.content,
        isSystem: false,
      })
      .returning(publicSkillColumns)
  );
  return (
    created ??
    (yield* new SkillDatabaseError({
      cause: new Error("Failed to create skill"),
    }))
  );
});

export const patchSkill = Effect.fn("skills.patch")(function* ({
  db,
  organizationId,
  name,
  body,
}: PatchSkillProgramInput) {
  yield* ensureRegistry();
  const existing = yield* database(() =>
    db.query.skills.findFirst({
      where: and(
        eq(skills.organizationId, organizationId),
        eq(skills.name, name)
      ),
      columns: { id: true, isSystem: true },
    })
  );
  if (!existing) {
    return yield* new SkillNotFoundError();
  }

  const nextName = body.name ?? name;
  if (existing.isSystem && nextName !== name) {
    return yield* new SystemSkillRenameError();
  }

  const updatedAt = DateTime.toDateUtc(yield* DateTime.now);
  const [updated] = yield* write(nextName, () =>
    db
      .update(skills)
      .set({
        name: nextName,
        description: body.description,
        content: body.content,
        updatedAt,
      })
      .where(
        and(eq(skills.organizationId, organizationId), eq(skills.name, name))
      )
      .returning(publicSkillColumns)
  );
  return updated ?? (yield* new SkillNotFoundError());
});

export const deleteSkill = Effect.fn("skills.delete")(function* ({
  db,
  organizationId,
  name,
}: NamedSkillProgramInput) {
  yield* ensureRegistry();
  const existing = yield* database(() =>
    db.query.skills.findFirst({
      where: and(
        eq(skills.organizationId, organizationId),
        eq(skills.name, name)
      ),
      columns: { id: true, isSystem: true },
    })
  );
  if (!existing) {
    return yield* new SkillNotFoundError();
  }
  if (existing.isSystem) {
    return yield* new SystemSkillDeleteError();
  }

  yield* database(() =>
    db
      .delete(skills)
      .where(
        and(eq(skills.organizationId, organizationId), eq(skills.name, name))
      )
  );
});
