import "zod/compile";
import { z } from "zod";

export const agentStreamEventSchema = z.looseObject({
  type: z.string(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export class AgentTaskTimeoutError extends Error {
  constructor(sessionId: string) {
    super(`Agent task session ${sessionId} did not complete in time`);
    this.name = "AgentTaskTimeoutError";
  }
}

export class AgentTaskFailedError extends Error {
  constructor(sessionId: string, detail: string) {
    super(`Agent task session ${sessionId} failed: ${detail}`);
    this.name = "AgentTaskFailedError";
  }
}
