export const WEBHOOK_EVENT_FIXTURES = [
  {
    type: "post.generation.completed",
    data: { jobId: "job-one", postId: "post-one" },
  },
  { type: "post.generation.failed", data: { jobId: "job-one", error: null } },
  { type: "post.generation.skipped", data: { jobId: "job-one", reason: null } },
  {
    type: "brand_identity.generation.completed",
    data: { jobId: "job-one", brandIdentityId: "brand-one" },
  },
  {
    type: "brand_identity.generation.failed",
    data: { jobId: "job-one", error: null },
  },
  { type: "post.published", data: { postId: "post-one" } },
  { type: "post.created", data: { postId: "post-one" } },
  { type: "post.updated", data: { postId: "post-one" } },
  { type: "post.deleted", data: { postId: "post-one" } },
  { type: "post.unpublished", data: { postId: "post-one" } },
  {
    type: "geo.scan.completed",
    data: {
      scanId: "scan-one",
      projectId: "project-one",
      runId: null,
      checksTotal: null,
      checksFailed: null,
      mentions: null,
      durationMs: null,
    },
  },
  {
    type: "geo.scan.failed",
    data: {
      scanId: "scan-one",
      projectId: "project-one",
      errorCode: null,
      error: null,
      failedStage: null,
      retryable: null,
    },
  },
  {
    type: "geo.alert.triggered",
    data: {
      automationId: "automation-one",
      automationName: "Visibility drops",
      signal: "visibility_drop",
      projectId: "project-one",
      scanId: "scan-one",
      title: "AI visibility dropped 20 pts for Acme",
      summary:
        "Mentioned in 40% of answers, down from 60% in the previous scan.",
      url: "https://app.usenotra.com/acme/geo",
      changes: [
        {
          prompt: "best issue tracker",
          engine: "openai/gpt-5",
          kind: "lost_mention",
          competitors: [],
        },
      ],
    },
  },
] as const;
