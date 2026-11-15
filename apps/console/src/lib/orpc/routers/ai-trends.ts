import {
  getAiTrendsDomainShare,
  getAiTrendsOverview,
} from "@/lib/ai-trends/queries";
import { getAiTrendsTraffic } from "@/lib/ai-trends/traffic";
import { assertAdmin } from "@/lib/auth/admin";
import { baseProcedure } from "@/lib/orpc/base";
import {
  aiTrendsDomainInputSchema,
  aiTrendsOverviewInputSchema,
} from "@/schemas/ai-trends";

export const aiTrendsRouter = {
  overview: baseProcedure
    .input(aiTrendsOverviewInputSchema)
    .handler(async ({ context, input }) => {
      await assertAdmin({ headers: context.headers });
      return getAiTrendsOverview(input.days);
    }),

  domainShare: baseProcedure
    .input(aiTrendsDomainInputSchema)
    .handler(async ({ context, input }) => {
      await assertAdmin({ headers: context.headers });
      return getAiTrendsDomainShare(input.days, input.domain);
    }),

  traffic: baseProcedure
    .input(aiTrendsOverviewInputSchema)
    .handler(async ({ context, input }) => {
      await assertAdmin({ headers: context.headers });
      return getAiTrendsTraffic(input.days);
    }),
};
