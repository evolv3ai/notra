import { SystemSkillVersionConflictError } from "@notra/ai/skills/errors";
import { publishSystemSkill } from "@notra/ai/skills/registry";
import {
  getSystemSkillForAdmin,
  listSystemSkillsForAdmin,
} from "@notra/ai/skills/registry-admin";

import { assertAdmin } from "@/lib/auth/admin";
import { baseProcedure } from "@/lib/orpc/base";
import {
  publishSystemSkillInputSchema,
  systemSkillNameInputSchema,
} from "@/schemas/skills";

import { conflict, notFound } from "../utils/errors";

export const skillsRouter = {
  list: baseProcedure.handler(async ({ context }) => {
    await assertAdmin({ headers: context.headers });
    const rows = await listSystemSkillsForAdmin();
    return rows.map((row) => ({
      ...row,
      updatedAt: row.updatedAt.toISOString(),
    }));
  }),
  get: baseProcedure
    .input(systemSkillNameInputSchema)
    .handler(async ({ context, input }) => {
      await assertAdmin({ headers: context.headers });
      const skill = await getSystemSkillForAdmin(input.name);
      if (!skill) {
        throw notFound("System skill not found");
      }
      return {
        ...skill,
        createdAt: skill.createdAt.toISOString(),
        updatedAt: skill.updatedAt.toISOString(),
        versions: skill.versions.map((version) => ({
          ...version,
          createdAt: version.createdAt.toISOString(),
        })),
      };
    }),
  publish: baseProcedure
    .input(publishSystemSkillInputSchema)
    .handler(async ({ context, input }) => {
      const { user } = await assertAdmin({ headers: context.headers });
      try {
        return await publishSystemSkill({
          ...input,
          publishedByUserId: user.id,
        });
      } catch (error) {
        if (error instanceof SystemSkillVersionConflictError) {
          throw conflict(error.message, {
            currentVersion: error.currentVersion,
          });
        }
        throw error;
      }
    }),
};
