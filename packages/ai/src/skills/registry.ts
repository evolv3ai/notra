import { db } from "@notra/db/drizzle";
import { skills, systemSkills, systemSkillVersions } from "@notra/db/schema";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

import { SystemSkillVersionConflictError } from "./errors";
import { buildSystemSkills } from "./system-skills";
import type {
  PublishSystemSkillInput,
  PublishSystemSkillResult,
  SkillUpstreamDetail,
  SkillUpstreamStatus,
  SyncSkillToLatestInput,
  SyncSkillToLatestResult,
  SystemSkillDefinition,
} from "./types";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface PublishedSkill extends SystemSkillDefinition {
  id: string;
  version: number;
}

const customizedSql = sql<boolean>`coalesce(
  ${skills.content} <> ${systemSkillVersions.content}
    or ${skills.description} <> ${systemSkillVersions.description},
  true
)`;

const baseVersionJoin = and(
  eq(systemSkillVersions.systemSkillId, skills.systemSkillId),
  eq(systemSkillVersions.version, skills.systemSkillVersion)
);

async function pushToOrganizations(tx: Transaction, skill: PublishedSkill) {
  const updated = await tx
    .update(skills)
    .set({
      description: skill.description,
      content: skill.content,
      systemSkillVersion: skill.version,
    })
    .from(systemSkillVersions)
    .where(
      and(
        eq(skills.systemSkillId, skill.id),
        lt(skills.systemSkillVersion, skill.version),
        baseVersionJoin,
        eq(skills.content, systemSkillVersions.content),
        eq(skills.description, systemSkillVersions.description)
      )
    )
    .returning({ id: skills.id });

  const added = await tx.execute<{ id: string }>(sql`
    insert into skills (
      id, organization_id, name, description, content, is_system,
      system_skill_id, system_skill_version
    )
    select
      gen_random_uuid()::text, o.id, ${skill.name}, ${skill.description},
      ${skill.content}, true, ${skill.id}, ${skill.version}
    from organizations o
    where not exists (
      select 1 from skills s
      where s.organization_id = o.id and s.system_skill_id = ${skill.id}
    )
    on conflict (organization_id, name) do nothing
    returning id
  `);

  return { updatedCopies: updated.length, addedCopies: added.rows.length };
}

async function bootstrapSystemSkill(definition: SystemSkillDefinition) {
  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(systemSkills)
      .values({ id: nanoid(), ...definition, version: 1 })
      .onConflictDoNothing({ target: systemSkills.name })
      .returning();
    if (!created) {
      return;
    }
    await tx.insert(systemSkillVersions).values({
      id: nanoid(),
      systemSkillId: created.id,
      version: 1,
      description: definition.description,
      content: definition.content,
      note: "Imported from code",
    });
    const neverEdited = sql`${skills.updatedAt} = ${skills.createdAt}`;
    await tx
      .update(skills)
      .set({
        systemSkillId: created.id,
        systemSkillVersion: 1,
        description: sql`case when ${neverEdited} then ${definition.description} else ${skills.description} end`,
        content: sql`case when ${neverEdited} then ${definition.content} else ${skills.content} end`,
      })
      .where(
        and(
          eq(skills.isSystem, true),
          isNull(skills.systemSkillId),
          eq(skills.name, definition.name)
        )
      );
    await pushToOrganizations(tx, created);
  });
}

let registryReady: Promise<void> | null = null;

async function bootstrapMissingSystemSkills() {
  const existing = await db
    .select({ name: systemSkills.name })
    .from(systemSkills);
  const names = new Set(existing.map((row) => row.name));
  for (const definition of buildSystemSkills()) {
    if (!names.has(definition.name)) {
      await bootstrapSystemSkill(definition);
    }
  }
}

export function ensureSystemSkillRegistry(): Promise<void> {
  registryReady ??= bootstrapMissingSystemSkills().catch((error: unknown) => {
    registryReady = null;
    throw error;
  });
  return registryReady;
}

export function publishSystemSkill(
  input: PublishSystemSkillInput
): Promise<PublishSystemSkillResult> {
  return db.transaction(async (tx) => {
    const [head] = await tx
      .select({ id: systemSkills.id, version: systemSkills.version })
      .from(systemSkills)
      .where(eq(systemSkills.name, input.name))
      .for("update");

    if ((head?.version ?? null) !== input.expectedVersion) {
      throw new SystemSkillVersionConflictError(
        input.name,
        head?.version ?? null
      );
    }

    const skill: PublishedSkill = {
      id: head?.id ?? nanoid(),
      version: (head?.version ?? 0) + 1,
      name: input.name,
      description: input.description,
      content: input.content,
    };

    if (head) {
      await tx
        .update(systemSkills)
        .set({
          description: skill.description,
          content: skill.content,
          version: skill.version,
        })
        .where(eq(systemSkills.id, skill.id));
    } else {
      await tx.insert(systemSkills).values(skill);
    }

    await tx.insert(systemSkillVersions).values({
      id: nanoid(),
      systemSkillId: skill.id,
      version: skill.version,
      description: skill.description,
      content: skill.content,
      note: input.note?.trim() || null,
      publishedByUserId: input.publishedByUserId ?? null,
    });

    const pushed = await pushToOrganizations(tx, skill);
    return { id: skill.id, version: skill.version, ...pushed };
  });
}

export async function listSkillUpstreamStatuses(
  organizationId: string
): Promise<Map<string, SkillUpstreamStatus>> {
  const rows = await db
    .select({
      id: skills.id,
      version: skills.systemSkillVersion,
      latestVersion: systemSkills.version,
      customized: customizedSql,
    })
    .from(skills)
    .innerJoin(systemSkills, eq(systemSkills.id, skills.systemSkillId))
    .leftJoin(systemSkillVersions, baseVersionJoin)
    .where(eq(skills.organizationId, organizationId));

  return new Map(
    rows.map((row) => [
      row.id,
      {
        version: row.version ?? 0,
        latestVersion: row.latestVersion,
        customized: row.customized,
      },
    ])
  );
}

export async function getSkillUpstream(
  organizationId: string,
  skillId: string
): Promise<SkillUpstreamDetail | null> {
  const [row] = await db
    .select({
      version: skills.systemSkillVersion,
      latestVersion: systemSkills.version,
      customized: customizedSql,
      latestDescription: systemSkills.description,
      latestContent: systemSkills.content,
      systemSkillId: systemSkills.id,
    })
    .from(skills)
    .innerJoin(systemSkills, eq(systemSkills.id, skills.systemSkillId))
    .leftJoin(systemSkillVersions, baseVersionJoin)
    .where(
      and(eq(skills.organizationId, organizationId), eq(skills.id, skillId))
    );
  if (!row) {
    return null;
  }

  const latest = await db.query.systemSkillVersions.findFirst({
    where: and(
      eq(systemSkillVersions.systemSkillId, row.systemSkillId),
      eq(systemSkillVersions.version, row.latestVersion)
    ),
    columns: { note: true, createdAt: true },
  });

  return {
    version: row.version ?? 0,
    latestVersion: row.latestVersion,
    customized: row.customized,
    latest: {
      description: row.latestDescription,
      content: row.latestContent,
      note: latest?.note ?? null,
      publishedAt: latest?.createdAt ?? new Date(0),
    },
  };
}

export async function syncSkillToLatest(
  organizationId: string,
  skillId: string,
  {
    keepCustomizations,
    reviewedVersion,
    reviewedUpdatedAt,
  }: SyncSkillToLatestInput
): Promise<SyncSkillToLatestResult> {
  const reviewedAt = reviewedUpdatedAt
    .toISOString()
    .replace("T", " ")
    .replace("Z", "");
  const [synced] = await db
    .update(skills)
    .set(
      keepCustomizations
        ? { systemSkillVersion: reviewedVersion }
        : {
            systemSkillVersion: reviewedVersion,
            description: sql`"system_skills"."description"`,
            content: sql`"system_skills"."content"`,
          }
    )
    .from(systemSkills)
    .where(
      and(
        eq(skills.organizationId, organizationId),
        eq(skills.id, skillId),
        eq(systemSkills.id, skills.systemSkillId),
        eq(systemSkills.version, reviewedVersion),
        sql`date_trunc('milliseconds', ${skills.updatedAt}) = ${reviewedAt}::timestamp`
      )
    )
    .returning({
      description: skills.description,
      content: skills.content,
      updatedAt: skills.updatedAt,
    });
  if (synced) {
    return { status: "synced", skill: synced };
  }

  const existing = await db.query.skills.findFirst({
    where: and(
      eq(skills.organizationId, organizationId),
      eq(skills.id, skillId)
    ),
    columns: { systemSkillId: true },
  });
  return existing?.systemSkillId
    ? { status: "conflict" }
    : { status: "not_found" };
}

export async function loadSystemSkill(name: string) {
  await ensureSystemSkillRegistry();
  const head = await db.query.systemSkills.findFirst({
    where: eq(systemSkills.name, name),
    columns: { name: true, description: true, content: true },
  });
  return head ?? null;
}
