import { z } from "zod";

/** A 👍/👎 the agent forwards from Slack; the dashboard acts on the finding. */
export const autopilotSlackActionRequestSchema = z.object({
  teamId: z.string().trim().min(1),
  channelId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  messageTs: z.string().trim().min(1),
  vote: z.enum(["up", "down"]),
});
