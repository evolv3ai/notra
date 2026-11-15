import { db } from "@notra/db/drizzle";
import {
  skills,
  systemSkills,
  systemSkillVersions,
  users,
} from "@notra/db/schema";
import { asc, desc, eq, sql } from "drizzle-orm";

import { ensureSystemSkillRegistry } from "./registry";
import { buildSystemSkills } from "./system-skills";
import type { SystemSkillAdoption } from "./types";

const EMPTY_ADOPTION: SystemSkillAdoption = {
  copies: 0,
  onLatest: 0,
  customized: 0,
};

async function adoptionBySkill(systemSkillId?: string) {
  const rows = await db
    .select({
      systemSkillId: skills.systemSkillId,
      copies: sql<number>`count(*)::int`,
      onLatest: sql<number>`count(*) filter (where ${skills.systemSkillVersion} = ${systemSkills.version})::int`,
      customized: sql<number>`count(*) filter (where coalesce(
        ${skills.content} <> ${systemSkillVersions.content}
          or ${skills.description} <> ${systemSkillVersions.description},
        true
      ))::int`,
    })
    .from(skills)
    .innerJoin(systemSkills, eq(systemSkills.id, skills.systemSkillId))
    .leftJoin(
      systemSkillVersions,
      sql`${systemSkillVersions.systemSkillId} = ${skills.systemSkillId} and ${systemSkillVersions.version} = ${skills.systemSkillVersion}`
    )
    .where(systemSkillId ? eq(skills.systemSkillId, systemSkillId) : undefined)
    .groupBy(skills.systemSkillId);

  return new Map(
    rows.map((row) => [
      row.systemSkillId,
      {
        copies: row.copies,
        onLatest: row.onLatest,
        customized: row.customized,
      },
    ])
  );
}

export async function listSystemSkillsForAdmin() {
  await ensureSystemSkillRegistry();
  const [heads, adoption] = await Promise.all([
    db
      .select({
        id: systemSkills.id,
        name: systemSkills.name,
        description: systemSkills.description,
        version: systemSkills.version,
        updatedAt: systemSkills.updatedAt,
      })
      .from(systemSkills)
      .orderBy(asc(systemSkills.name)),
    adoptionBySkill(),
  ]);

  return heads.map((head) => ({
    ...head,
    adoption: adoption.get(head.id) ?? EMPTY_ADOPTION,
  }));
}

export async function getSystemSkillForAdmin(name: string) {
  await ensureSystemSkillRegistry();
  const head = await db.query.systemSkills.findFirst({
    where: eq(systemSkills.name, name),
  });
  if (!head) {
    return null;
  }

  const [versions, adoption] = await Promise.all([
    db
      .select({
        version: systemSkillVersions.version,
        description: systemSkillVersions.description,
        content: systemSkillVersions.content,
        note: systemSkillVersions.note,
        createdAt: systemSkillVersions.createdAt,
        publishedBy: users.email,
      })
      .from(systemSkillVersions)
      .leftJoin(users, eq(users.id, systemSkillVersions.publishedByUserId))
      .where(eq(systemSkillVersions.systemSkillId, head.id))
      .orderBy(desc(systemSkillVersions.version)),
    adoptionBySkill(head.id),
  ]);

  const inCode = buildSystemSkills().find(
    (definition) => definition.name === name
  );

  return {
    ...head,
    versions,
    adoption: adoption.get(head.id) ?? EMPTY_ADOPTION,
    codeDefinition:
      inCode &&
      (inCode.content !== head.content ||
        inCode.description !== head.description)
        ? { description: inCode.description, content: inCode.content }
        : null,
  };
}
