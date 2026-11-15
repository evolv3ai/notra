import { db } from "@notra/db/drizzle";
import { skills, systemSkills } from "@notra/db/schema";
import { nanoid } from "nanoid";

import { ensureSystemSkillRegistry } from "./registry";

export async function seedSystemSkills(
  organizationId: string
): Promise<number> {
  await ensureSystemSkillRegistry();
  const heads = await db.select().from(systemSkills);
  if (heads.length === 0) {
    return 0;
  }
  const inserted = await db
    .insert(skills)
    .values(
      heads.map((head) => ({
        id: nanoid(),
        organizationId,
        name: head.name,
        description: head.description,
        content: head.content,
        isSystem: true,
        systemSkillId: head.id,
        systemSkillVersion: head.version,
      }))
    )
    .onConflictDoNothing({ target: [skills.organizationId, skills.name] })
    .returning({ id: skills.id });
  return inserted.length;
}
