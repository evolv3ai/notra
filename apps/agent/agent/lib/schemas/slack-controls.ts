import { z } from "zod";

export const slackControlValueSchema = z.object({
  sessionId: z.string().min(1),
  turnId: z.string().min(1),
});
