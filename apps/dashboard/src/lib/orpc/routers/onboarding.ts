import { retrieveBrand, searchBrands } from "@notra/ai/utils/context-dev";
import { db } from "@notra/db/drizzle";
import {
  geoAgentReadinessReports,
  geoCompetitors,
  geoPrompts,
  geoScans,
  onboardingSuggestions,
  organizations,
} from "@notra/db/schema";
import { createGeoProject } from "@notra/geo-core/geo/projects";
import { organizationIdInputSchema } from "@notra/schemas/dashboard/auth/organization";
import {
  dismissSuggestionInputSchema,
  listSuggestionsInputSchema,
} from "@notra/schemas/dashboard/onboarding-agent";
import { companyLogoInputSchema } from "@notra/schemas/dashboard/onboarding/company-logo";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, sql } from "drizzle-orm";

import { COMPANY_LOGO_LOOKUP_TIMEOUT_MS } from "@/constants/company-logo";
import { assertOrganizationAccess } from "@/lib/auth/organization";
import { getTranslations } from "@/lib/i18n/server";
import {
  getOnboardingAgentState,
  startSelfServeOnboardingAgent,
} from "@/lib/onboarding-agent";
import {
  pickBrandSearchResult,
  pickCompanyLogoUrl,
} from "@/lib/onboarding/company-logo";
import {
  readCachedCompanyLogo,
  writeCachedCompanyLogo,
} from "@/lib/onboarding/company-logo-cache";
import { authorizedProcedure, withOrganizationAccess } from "@/lib/orpc/base";
import { runOrpcEffect } from "@/lib/orpc/effect";
import { toGeoOrpcError } from "@/lib/orpc/utils/geo-errors";
import type { CompanyLogoResult } from "@/types/onboarding";
import { resolveOnboardingAgentRunState } from "@/utils/onboarding-agent-run";
import { ratelimit } from "@/utils/ratelimit";

export const onboardingRouter = {
  companyLogo: authorizedProcedure
    .input(companyLogoInputSchema)
    .handler(async ({ context, input }): Promise<CompanyLogoResult> => {
      const cacheKeyInput = {
        query: input.query,
        searchByName: input.searchByName,
      };

      const cached = await readCachedCompanyLogo(cacheKeyInput);
      if (cached) {
        return cached;
      }

      const { success: withinLimit, reason } =
        await ratelimit.companyLogo.limit(context.user.id);
      // Upstash returns success on timeout; paid lookups must fail closed.
      if (!withinLimit || reason === "timeout") {
        const tErrors = await getTranslations("errors.onboarding");
        throw new ORPCError("TOO_MANY_REQUESTS", {
          message: tErrors("tooManyLogoLookups"),
        });
      }

      const signal = AbortSignal.timeout(COMPANY_LOGO_LOOKUP_TIMEOUT_MS);
      let result: CompanyLogoResult;
      try {
        if (input.searchByName) {
          const response = await searchBrands(input.query, { signal });
          const brand = pickBrandSearchResult(response.results, input.query);
          result = {
            domain: brand?.domain ?? null,
            url: brand?.logo || null,
          };
        } else {
          const response = await retrieveBrand(input.query, { signal });
          result = {
            domain: response.brand?.domain ?? input.query,
            url: pickCompanyLogoUrl(response.brand?.logos),
          };
        }
      } catch {
        result = {
          domain: input.searchByName ? null : input.query,
          url: null,
        };
      }

      await writeCachedCompanyLogo(cacheKeyInput, result);
      return result;
    }),
  createDevReplayProject: authorizedProcedure
    .input(organizationIdInputSchema)
    .handler(async ({ context, input }) => {
      if (process.env.NODE_ENV !== "development") {
        throw new ORPCError("NOT_FOUND");
      }

      await assertOrganizationAccess({
        headers: context.headers,
        organizationId: input.organizationId,
        user: context.user,
      });

      const project = await runOrpcEffect(
        createGeoProject(input.organizationId, "Onboarding replay"),
        toGeoOrpcError
      );
      return { projectId: project.id };
    }),
  get: authorizedProcedure
    .input(organizationIdInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ input }) => {
      const organizationId = input.organizationId;
      const [org] = await db
        .select({
          onboardingCompleted: organizations.onboardingCompleted,
          onboardingDismissed: organizations.onboardingDismissed,
          hasPrompt: sql<boolean>`exists (select 1 from ${geoPrompts} where ${geoPrompts.organizationId} = ${organizationId})`,
          hasCompetitor: sql<boolean>`exists (select 1 from ${geoCompetitors} where ${geoCompetitors.organizationId} = ${organizationId})`,
          hasScan: sql<boolean>`exists (select 1 from ${geoScans} where ${geoScans.organizationId} = ${organizationId} and ${geoScans.status} = 'completed')`,
          hasAgentReadiness: sql<boolean>`exists (select 1 from ${geoAgentReadinessReports} where ${geoAgentReadinessReports.organizationId} = ${organizationId} and ${geoAgentReadinessReports.status} = 'completed')`,
        })
        .from(organizations)
        .where(eq(organizations.id, input.organizationId))
        .limit(1);

      const hasPrompt = org?.hasPrompt ?? false;
      const hasCompetitor = org?.hasCompetitor ?? false;
      const hasScan = org?.hasScan ?? false;
      const hasAgentReadiness = org?.hasAgentReadiness ?? false;
      const onboardingCompleted = org?.onboardingCompleted ?? false;
      const onboardingDismissed = org?.onboardingDismissed ?? false;

      const setupComplete =
        hasPrompt && hasCompetitor && hasScan && hasAgentReadiness;

      if (setupComplete && !onboardingCompleted) {
        await db
          .update(organizations)
          .set({ onboardingCompleted: true })
          .where(eq(organizations.id, input.organizationId));
      }

      return {
        hasPrompt,
        hasCompetitor,
        hasScan,
        hasAgentReadiness,
        onboardingCompleted: setupComplete || onboardingCompleted,
        onboardingDismissed,
      };
    }),
  agentRun: authorizedProcedure
    .input(organizationIdInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ input }) => {
      return resolveOnboardingAgentRunState(
        await getOnboardingAgentState(input.organizationId)
      );
    }),
  runAgent: authorizedProcedure
    .input(organizationIdInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      const { success: withinLimit } = await ratelimit.onboardingAgent.limit(
        input.organizationId
      );
      if (!withinLimit) {
        const tErrors = await getTranslations("errors.onboarding");
        throw new ORPCError("TOO_MANY_REQUESTS", {
          message: tErrors("tooManyAgentRequests"),
        });
      }

      const result = await startSelfServeOnboardingAgent({
        email: context.user.email,
        organizationId: input.organizationId,
      });

      if (
        !result.started &&
        (result.reason === "no-company-domain" ||
          result.reason === "website-unreachable")
      ) {
        const tErrors = await getTranslations("errors.onboarding");
        throw new ORPCError("BAD_REQUEST", {
          message: tErrors(`selfServeAgent.${result.reason}`),
        });
      }

      return { started: result.started };
    }),
  suggestions: authorizedProcedure
    .input(listSuggestionsInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ input }) => {
      const filters = [
        eq(onboardingSuggestions.organizationId, input.organizationId),
      ];
      if (!input.includeDismissed) {
        filters.push(eq(onboardingSuggestions.dismissed, false));
      }

      return await db.query.onboardingSuggestions.findMany({
        orderBy: [desc(onboardingSuggestions.createdAt)],
        where: and(...filters),
      });
    }),
  dismissSuggestion: authorizedProcedure
    .input(dismissSuggestionInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ input }) => {
      const updated = await db
        .update(onboardingSuggestions)
        .set({ dismissed: true })
        .where(
          and(
            eq(onboardingSuggestions.id, input.suggestionId),
            eq(onboardingSuggestions.organizationId, input.organizationId)
          )
        )
        .returning({ id: onboardingSuggestions.id });

      if (!updated[0]) {
        throw new ORPCError("NOT_FOUND", {
          message: "Suggestion not found",
        });
      }

      return { id: updated[0].id };
    }),
};
