import { UTILITY_MODEL_ID } from "@notra/ai/constants/models";
import { gateway } from "@notra/ai/gateway";
import { withRouterDefaults } from "@notra/ai/provider-options";
import { buildTelemetryOptions } from "@notra/ai/utils/tcc";
import { db } from "@notra/db/drizzle";
import { members, organizations } from "@notra/db/schema";
import {
  commandPaletteNavigateRequestSchema,
  commandPaletteNavigateResultSchema,
} from "@notra/schemas/dashboard/command-palette";
import { isDemoMode } from "@notra/utils/demo-mode";
import { generateText, Output } from "ai";
import { and, eq } from "drizzle-orm";
import { createRequestLogger } from "evlog";

import { isAnalyticsEnabledForOrganization } from "@/lib/analytics/flag";
import { getServerSession } from "@/lib/auth/session";
import { isAutopilotEnabledForOrganization } from "@/lib/autopilot/flag";
import { hasAiCreditsGrant } from "@/lib/billing/subscription";
import { resolveNavigationWithJev } from "@/lib/command-palette/jev-navigation";
import { searchWorkspace } from "@/lib/search/workspace-search";
import type {
  CommandPaletteEntityTarget,
  CommandPaletteNavigationEntity,
} from "@/types/components/command-palette";
import {
  commandPaletteEntityPath,
  commandRoutesForAI,
  findNameMatch,
} from "@/utils/command-palette";
import { truncateSnippet } from "@/utils/format";
import { getClientIp, ratelimit } from "@/utils/ratelimit";

const NAVIGATION_SEARCH_LIMIT = 3;

type WorkspaceSearchResult = Awaited<ReturnType<typeof searchWorkspace>>;

function toNavigationEntities(
  slug: string,
  data: WorkspaceSearchResult
): CommandPaletteNavigationEntity[] {
  const targets: CommandPaletteEntityTarget[] = [
    ...data.prompts.map((row) => ({
      kind: "prompt" as const,
      id: row.id,
      name: row.prompt,
    })),
    ...data.competitors.map((row) => ({
      kind: "competitor" as const,
      id: row.id,
      name: row.name,
    })),
    ...data.personas.map((row) => ({
      kind: "persona" as const,
      id: row.id,
      name: `${row.name} (${row.role}, ${row.company})`,
    })),
    ...data.posts.map((row) => ({
      kind: "post" as const,
      id: row.id,
      name: `${row.title} (${row.status})`,
    })),
    ...data.chats.map((row) => ({
      kind: "chat" as const,
      id: row.id,
      name: row.title,
    })),
    ...data.sites.map((row) => ({
      kind: "site" as const,
      id: row.id,
      name: `${row.name} (${row.publicOrigin})`,
    })),
    ...data.voices.map((row) => ({
      kind: "voice" as const,
      id: row.id,
      name: [row.name, row.companyName, row.websiteUrl]
        .filter(Boolean)
        .join(" – "),
    })),
    ...data.references.map((row) => ({
      kind: "reference" as const,
      id: row.id,
      name: `${row.type}: ${truncateSnippet(row.content, 80)}`,
    })),
    ...data.githubIntegrations.map((row) => ({
      kind: "github" as const,
      id: row.id,
      name:
        row.owner && row.repo
          ? `${row.displayName} (${row.owner}/${row.repo})`
          : row.displayName,
    })),
    ...data.linearIntegrations.map((row) => ({
      kind: "linear" as const,
      id: row.id,
      name: [row.displayName, row.linearOrganizationName, row.linearTeamName]
        .filter(Boolean)
        .join(" – "),
    })),
    ...data.socialAccounts.map((row) => ({
      kind: "social" as const,
      id: row.id,
      name: `${row.displayName} (${row.provider} @${row.username})`,
    })),
  ];
  return targets.map((target) => ({
    type: target.kind,
    label: target.name,
    path: commandPaletteEntityPath(slug, target),
  }));
}

export async function POST(request: Request) {
  const log = createRequestLogger({
    method: "POST",
    path: "/api/command-palette/navigate",
  });

  const { session, user } = await getServerSession({
    headers: request.headers,
  });

  if (!(session && user)) {
    log.set({ feature: "command_palette", unauthorized: true });
    log.emit();
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success, reset } = await ratelimit.commandPaletteNavigate.limit(
    user.id || getClientIp(request)
  );
  if (!success) {
    return Response.json(
      { error: "Rate limit exceeded", reset },
      { status: 429 }
    );
  }

  const parsed = commandPaletteNavigateRequestSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { query, slug, projectId } = parsed.data;

  const [member] = await db
    .select({ id: members.id, organizationId: members.organizationId })
    .from(members)
    .innerJoin(organizations, eq(members.organizationId, organizations.id))
    .where(and(eq(organizations.slug, slug), eq(members.userId, user.id)))
    .limit(1);
  if (!member) {
    log.set({ feature: "command_palette", forbiddenSlug: true });
    log.emit();
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const organizationId = member.organizationId;
  const [hasAiCredits, autopilot, analytics, searchData] = await Promise.all([
    hasAiCreditsGrant(organizationId).catch(() => false),
    isAutopilotEnabledForOrganization(organizationId),
    isAnalyticsEnabledForOrganization(organizationId).catch(() => false),
    searchWorkspace({
      organizationId,
      projectId,
      query,
      limit: NAVIGATION_SEARCH_LIMIT,
    }),
  ]);
  const entities = toNavigationEntities(slug, searchData);
  const routes = commandRoutesForAI(slug, hasAiCredits, {
    autopilot,
    analytics,
    sites: !isDemoMode(),
  });

  const allPaths = [
    ...routes.map((r) => r.path),
    ...entities.map((e) => e.path),
  ];

  const nameMatch = findNameMatch(query, entities);
  if (nameMatch) {
    return Response.json({
      action: "navigate",
      path: nameMatch.path,
      reason: `"${nameMatch.label}" matches by name.`,
    });
  }

  const jevDecision = await resolveNavigationWithJev({
    query,
    routes,
    entities,
    organizationId,
    abortSignal: request.signal,
  });
  if (jevDecision) {
    return Response.json(jevDecision);
  }

  try {
    const { output: object } = await generateText({
      model: gateway(UTILITY_MODEL_ID, { organizationId }),
      output: Output.object({ schema: commandPaletteNavigateResultSchema }),
      instructions: [
        "You are a navigation router for the Notra dashboard command palette.",
        "Given a natural language query, decide whether to navigate to an existing route or fall back to the AI chat.",
        "You receive two lists: static dashboard routes AND matching entities (GEO prompts, competitors, personas, posts, chats, sites, brand voices, references, integrations) from the user's workspace.",
        "If the query matches an entity (e.g. a brand voice name, a post title, a company name, a website URL), navigate to that entity's path.",
        "If the query matches a static route, navigate there.",
        "Only return `navigate` with a path that EXACTLY matches one of the provided paths.",
        "Prefer entity matches over static routes when relevant.",
        "Only fall back to `chat` if no route or entity confidently matches.",
        "Keep `reason` under 120 characters, plain language, no quotes.",
      ].join(" "),
      prompt: [
        `Dashboard routes: ${JSON.stringify(routes)}`,
        entities.length > 0
          ? `Matching entities: ${JSON.stringify(entities)}`
          : "No matching entities found.",
        `User query: ${query}`,
      ].join("\n"),
      providerOptions: withRouterDefaults(
        { gateway: { tags: ["command-palette-navigation"] } },
        { modelId: UTILITY_MODEL_ID }
      ),
      abortSignal: request.signal,
      ...buildTelemetryOptions({
        feature: "command_palette",
        organizationId,
        routeName: "/api/command-palette/navigate",
        slug,
        userId: user.id,
      }),
    });

    if (
      object.action === "navigate" &&
      object.path &&
      allPaths.includes(object.path)
    ) {
      return Response.json({
        action: "navigate",
        path: object.path,
        reason: object.reason,
      });
    }

    return Response.json({
      action: "chat",
      path: null,
      reason: object.reason || "No confident route match.",
    });
  } catch (error) {
    log.set({
      feature: "command_palette",
      userId: user.id,
      slug,
      error: error instanceof Error ? error.message : String(error),
    });
    log.emit();
    return Response.json({
      action: "chat",
      path: null,
      reason: "AI unavailable, opening chat.",
    });
  }
}
