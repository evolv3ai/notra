import { lazy } from "@orpc/server";

// Lazy so a cold function only loads the routers a request actually calls:
// together they pull in most of the server bundle (AI SDKs, Linear, S3,
// workflows), which cost seconds on the first request of every new instance.
export const dashboardRouter = {
  comments: lazy(() =>
    import("./routers/comments").then((m) => ({ default: m.commentsRouter }))
  ),
  outboundWebhooks: lazy(() =>
    import("./routers/outbound-webhooks").then((m) => ({
      default: m.outboundWebhooksRouter,
    }))
  ),
  agentFeedback: lazy(() =>
    import("./routers/agent-feedback").then((m) => ({
      default: m.agentFeedbackRouter,
    }))
  ),
  analytics: lazy(() =>
    import("./routers/analytics").then((m) => ({ default: m.analyticsRouter }))
  ),
  apiKeys: lazy(() =>
    import("./routers/api-keys").then((m) => ({ default: m.apiKeysRouter }))
  ),
  attachments: lazy(() =>
    import("./routers/attachments").then((m) => ({
      default: m.attachmentsRouter,
    }))
  ),
  automation: lazy(() =>
    import("./routers/automation").then((m) => ({
      default: m.automationRouter,
    }))
  ),
  brand: lazy(() =>
    import("./routers/brand").then((m) => ({ default: m.brandRouter }))
  ),
  chat: lazy(() =>
    import("./routers/chat").then((m) => ({ default: m.chatRouter }))
  ),
  content: lazy(() =>
    import("./routers/content").then((m) => ({ default: m.contentRouter }))
  ),
  contentCalendar: lazy(() =>
    import("./routers/content-calendar").then((m) => ({
      default: m.contentCalendarRouter,
    }))
  ),
  feedback: lazy(() =>
    import("./routers/feedback").then((m) => ({ default: m.feedbackRouter }))
  ),
  geo: lazy(() =>
    import("./routers/geo").then((m) => ({ default: m.geoRouter }))
  ),
  trafficEmbeds: lazy(() =>
    import("./routers/traffic-embeds").then((m) => ({
      default: m.trafficEmbedsRouter,
    }))
  ),
  github: lazy(() =>
    import("./routers/github").then((m) => ({ default: m.githubRouter }))
  ),
  autopilot: lazy(() =>
    import("./routers/autopilot").then((m) => ({ default: m.autopilotRouter }))
  ),
  sites: lazy(() =>
    import("./routers/sites").then((m) => ({ default: m.sitesRouter }))
  ),
  integrations: lazy(() =>
    import("./routers/integrations").then((m) => ({
      default: m.integrationsRouter,
    }))
  ),
  logs: lazy(() =>
    import("./routers/logs").then((m) => ({ default: m.logsRouter }))
  ),
  notifications: lazy(() =>
    import("./routers/notifications").then((m) => ({
      default: m.notificationsRouter,
    }))
  ),
  onboarding: lazy(() =>
    import("./routers/onboarding").then((m) => ({
      default: m.onboardingRouter,
    }))
  ),
  organization: lazy(() =>
    import("./routers/organization").then((m) => ({
      default: m.organizationRouter,
    }))
  ),
  search: lazy(() =>
    import("./routers/search").then((m) => ({ default: m.searchRouter }))
  ),
  skills: lazy(() =>
    import("./routers/skills").then((m) => ({ default: m.skillsRouter }))
  ),
  socialAccounts: lazy(() =>
    import("./routers/social-accounts").then((m) => ({
      default: m.socialAccountsRouter,
    }))
  ),
  upload: lazy(() =>
    import("./routers/upload").then((m) => ({ default: m.uploadRouter }))
  ),
  usageAlerts: lazy(() =>
    import("./routers/usage-alerts").then((m) => ({
      default: m.usageAlertsRouter,
    }))
  ),
  user: lazy(() =>
    import("./routers/user").then((m) => ({ default: m.userRouter }))
  ),
};

export type DashboardRouter = typeof dashboardRouter;
