import { aiTrendsRouter } from "./routers/ai-trends";
import { autopilotRouter } from "./routers/autopilot";
import { freeScansRouter } from "./routers/free-scans";
import { integrationsRouter } from "./routers/integrations";
import { moderationRouter } from "./routers/moderation";
import { reviewRouter } from "./routers/review";
import { sitesRouter } from "./routers/sites";
import { skillsRouter } from "./routers/skills";

export const consoleRouter = {
  aiTrends: aiTrendsRouter,
  autopilot: autopilotRouter,
  freeScans: freeScansRouter,
  integrations: integrationsRouter,
  moderation: moderationRouter,
  review: reviewRouter,
  sites: sitesRouter,
  skills: skillsRouter,
};

export type ConsoleRouter = typeof consoleRouter;
