import {
  ensureSystemSkillRegistry,
  getSkillUpstream,
  listSkillUpstreamStatuses,
  syncSkillToLatest,
} from "@notra/ai/skills/registry";
import { db } from "@notra/db/drizzle";
import { skills } from "@notra/db/schema";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import {
  createSkillInputSchema,
  deleteSkillInputSchema,
  getSkillInputSchema,
  importSkillFromUrlInputSchema,
  listSkillsInputSchema,
  syncSystemSkillInputSchema,
  updateSkillInputSchema,
} from "@notra/schemas/dashboard/skills";
import { and, asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { getTranslations } from "@/lib/i18n/server";
import { authorizedProcedure, withOrganizationAccess } from "@/lib/orpc/base";
import { parseSkillFrontmatter } from "@/lib/skills/parse-frontmatter";

import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  serviceUnavailable,
} from "../utils/errors";

const SKILLS_SH_API_BASE = "https://skills.sh/api/v1/skills";

interface SkillsShFile {
  path: string;
  contents: string;
}

interface SkillsShSkill {
  id?: string;
  source?: string;
  slug?: string;
  files?: SkillsShFile[] | null;
}

const SKILL_MD_REGEX = /(^|\/)SKILL\.md$/i;

function pickPrimarySkillFile(files: SkillsShFile[]): SkillsShFile | null {
  const named = files.find((f) => SKILL_MD_REGEX.test(f.path));
  if (named) {
    return named;
  }
  const anyMd = files.find((f) => f.path.toLowerCase().endsWith(".md"));
  return anyMd ?? files[0] ?? null;
}

function skillByName(organizationId: string, name: string) {
  return and(eq(skills.organizationId, organizationId), eq(skills.name, name));
}

function findSkillAccess(organizationId: string, name: string) {
  return db.query.skills.findFirst({
    where: skillByName(organizationId, name),
    columns: { id: true, isSystem: true },
  });
}

export const skillsRouter = {
  list: authorizedProcedure
    .input(listSkillsInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ input }) => {
      await ensureSystemSkillRegistry();
      const [rows, upstream] = await Promise.all([
        db
          .select({
            id: skills.id,
            name: skills.name,
            description: skills.description,
            isSystem: skills.isSystem,
            updatedAt: skills.updatedAt,
          })
          .from(skills)
          .where(eq(skills.organizationId, input.organizationId))
          .orderBy(asc(skills.name)),
        listSkillUpstreamStatuses(input.organizationId),
      ]);

      return rows.map((row) => ({
        ...row,
        updatedAt: row.updatedAt.toISOString(),
        upstream: upstream.get(row.id) ?? null,
      }));
    }),

  getByName: authorizedProcedure
    .input(getSkillInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ input }) => {
      await ensureSystemSkillRegistry();
      const row = await db.query.skills.findFirst({
        where: skillByName(input.organizationId, input.name),
        columns: {
          id: true,
          name: true,
          description: true,
          content: true,
          isSystem: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!row) {
        throw notFound("Skill not found");
      }

      const upstream = row.isSystem
        ? await getSkillUpstream(input.organizationId, row.id)
        : null;
      return {
        ...row,
        upstream: upstream && {
          ...upstream,
          latest: {
            ...upstream.latest,
            publishedAt: upstream.latest.publishedAt.toISOString(),
          },
        },
      };
    }),

  create: authorizedProcedure
    .input(createSkillInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      const existing = await db.query.skills.findFirst({
        where: skillByName(input.organizationId, input.payload.name),
        columns: { id: true },
      });

      if (existing) {
        const tErrors = await getTranslations("errors.skills");
        throw conflict(tErrors("nameTaken", { name: input.payload.name }));
      }

      const [created] = await db
        .insert(skills)
        .values({
          id: nanoid(),
          organizationId: input.organizationId,
          name: input.payload.name,
          description: input.payload.description,
          content: input.payload.content,
          isSystem: false,
        })
        .returning({
          name: skills.name,
        });

      trackServerEvent({
        event: POSTHOG_EVENTS.SKILL_CREATED,
        headers: context.headers,
        userId: context.user.id,
        organizationId: input.organizationId,
        properties: {
          has_frontmatter:
            parseSkillFrontmatter(input.payload.content) !== null,
        },
      });

      return { name: created?.name ?? input.payload.name };
    }),

  update: authorizedProcedure
    .input(updateSkillInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      const row = await findSkillAccess(input.organizationId, input.name);

      if (!row) {
        throw notFound("Skill not found");
      }

      const nextName = input.payload.name ?? input.name;
      const isRename = nextName !== input.name;

      if (isRename) {
        if (row.isSystem) {
          const tErrors = await getTranslations("errors.skills");
          throw forbidden(tErrors("systemSkillRename"));
        }

        const conflictRow = await db.query.skills.findFirst({
          where: skillByName(input.organizationId, nextName),
          columns: { id: true },
        });

        if (conflictRow) {
          const tErrors = await getTranslations("errors.skills");
          throw conflict(tErrors("nameTaken", { name: nextName }));
        }
      }

      await db
        .update(skills)
        .set({
          name: nextName,
          description: input.payload.description,
          content: input.payload.content,
        })
        .where(skillByName(input.organizationId, input.name));

      trackServerEvent({
        event: POSTHOG_EVENTS.SKILL_UPDATED,
        headers: context.headers,
        userId: context.user.id,
        organizationId: input.organizationId,
        properties: {
          is_rename: isRename,
          is_system: row.isSystem,
          has_frontmatter:
            parseSkillFrontmatter(input.payload.content) !== null,
        },
      });

      return { success: true as const, name: nextName };
    }),

  delete: authorizedProcedure
    .input(deleteSkillInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      const row = await findSkillAccess(input.organizationId, input.name);

      if (!row) {
        throw notFound("Skill not found");
      }

      if (row.isSystem) {
        const tErrors = await getTranslations("errors.skills");
        throw forbidden(tErrors("systemSkillDelete"));
      }

      await db
        .delete(skills)
        .where(skillByName(input.organizationId, input.name));

      trackServerEvent({
        event: POSTHOG_EVENTS.SKILL_DELETED,
        headers: context.headers,
        userId: context.user.id,
        organizationId: input.organizationId,
      });

      return { success: true as const };
    }),

  syncSystemSkill: authorizedProcedure
    .input(syncSystemSkillInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      const row = await findSkillAccess(input.organizationId, input.name);
      if (!row?.isSystem) {
        throw notFound("Skill not found");
      }

      const result = await syncSkillToLatest(input.organizationId, row.id, {
        keepCustomizations: input.keepCustomizations,
        reviewedVersion: input.reviewedVersion,
        reviewedUpdatedAt: input.reviewedUpdatedAt,
      });
      if (result.status === "not_found") {
        throw notFound("Skill not found");
      }
      if (result.status === "conflict") {
        const tErrors = await getTranslations("errors.skills");
        throw conflict(tErrors("updateStale"));
      }

      trackServerEvent({
        event: POSTHOG_EVENTS.SKILL_UPDATED,
        headers: context.headers,
        userId: context.user.id,
        organizationId: input.organizationId,
        properties: {
          is_rename: false,
          is_system: true,
          system_update: input.keepCustomizations ? "kept" : "applied",
        },
      });

      return result.skill;
    }),

  importFromUrl: authorizedProcedure
    .input(importSkillFromUrlInputSchema)
    .handler(async ({ context, input }) => {
      let pathname: string;
      let sourceHost: string;
      try {
        const sourceUrl = new URL(input.url);
        // Linear split instead of /\/+$/, which backtracks on long slash runs.
        pathname = sourceUrl.pathname.split("/").filter(Boolean).join("/");
        sourceHost = sourceUrl.hostname;
      } catch {
        const tErrors = await getTranslations("errors.skills");
        throw badRequest(tErrors("invalidUrl"));
      }

      if (!pathname) {
        const tErrors = await getTranslations("errors.skills");
        throw badRequest(tErrors("urlNotSkill"));
      }

      const apiKey = process.env.SKILLS_SH_API_KEY;
      const headers: Record<string, string> = { Accept: "application/json" };
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      let response: Response;
      try {
        response = await fetch(`${SKILLS_SH_API_BASE}/${pathname}`, {
          headers,
        });
      } catch {
        const tErrors = await getTranslations("errors.skills");
        throw serviceUnavailable(tErrors("skillsShUnavailable"));
      }

      if (response.status === 404) {
        throw notFound("Skill not found on skills.sh");
      }

      if (!response.ok) {
        const tErrors = await getTranslations("errors.skills");
        throw serviceUnavailable(tErrors("skillsShUnavailable"));
      }

      const data = (await response.json()) as SkillsShSkill;
      const file = pickPrimarySkillFile(data.files ?? []);
      if (!file) {
        const tErrors = await getTranslations("errors.skills");
        throw badRequest(tErrors("noImportableFiles"));
      }

      const parsed = parseSkillFrontmatter(file.contents);

      trackServerEvent({
        event: POSTHOG_EVENTS.SKILL_IMPORTED_FROM_URL,
        headers: context.headers,
        userId: context.user.id,
        properties: {
          source_host: sourceHost,
          has_frontmatter: parsed !== null,
          file_count: data.files?.length ?? 0,
        },
      });

      return {
        name: parsed?.name ?? data.slug ?? "",
        description: parsed?.description ?? "",
        content: parsed?.body ?? file.contents,
        source: data.source ?? null,
        slug: data.slug ?? null,
      };
    }),
};
