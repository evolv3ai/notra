import { z } from "zod";

/** The fields Autopilot reads from a pull_request webhook. */
export const autopilotPullRequestEventSchema = z.object({
  action: z.string(),
  installation: z.object({ id: z.number() }),
  repository: z.object({
    id: z.number(),
    name: z.string(),
    full_name: z.string(),
    private: z.boolean().optional(),
    owner: z.object({ login: z.string() }),
  }),
  pull_request: z.object({
    number: z.number(),
    title: z.string(),
    body: z.string().nullable().optional(),
    html_url: z.string(),
    merged: z.boolean().nullable().optional(),
    draft: z.boolean().nullable().optional(),
    head: z.object({ ref: z.string() }),
    user: z
      .object({ type: z.string(), login: z.string().optional() })
      .nullable()
      .optional(),
    // Missing reads as untrusted: only the repository's own people start Autopilot.
    author_association: z.string().optional(),
  }),
});
