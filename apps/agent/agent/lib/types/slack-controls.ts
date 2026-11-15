import type { Session } from "eve/channels";
import type { SlackPostInput, SlackThread } from "eve/channels/slack";
import type { z } from "zod";

import type { slackControlValueSchema } from "../schemas/slack-controls";

export type SlackControl = "stop" | "leave";

export interface SlackControlContext {
  thread: Pick<SlackThread, "post">;
  resolveSession(): Promise<
    Pick<Session, "id" | "cancel" | "reset"> | undefined
  >;
}

export type SlackControlValue = z.infer<typeof slackControlValueSchema>;

export type SlackControlsPost = Extract<
  SlackPostInput,
  { readonly blocks: readonly unknown[] }
> & { readonly text: string };

export type SlackControlsPhase = "working" | "waiting" | "idle";

export interface SlackControlsRendererState {
  sessionId: string;
  messageTs: string;
  text: string;
  turnId: string;
}
