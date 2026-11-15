import { getSessionAttribute } from "@notra/tools/utils/session";
import { defineHook } from "eve/hooks";

import {
  appendAndPublishMirrorMessage,
  mirrorAssistantMetadata,
  resolveMirrorChatId,
  runMirrorEffect,
} from "../lib/utils/chat-mirror";

export default defineHook({
  events: {
    async "message.completed"(event, ctx) {
      const messageText = event.data.message;
      if (event.data.finishReason === "tool-calls" || !messageText?.trim()) {
        return;
      }

      const organizationId = getSessionAttribute(ctx, "organizationId");
      const chatId = resolveMirrorChatId(ctx);
      if (!(organizationId && chatId)) {
        return;
      }

      await runMirrorEffect(
        appendAndPublishMirrorMessage(organizationId, chatId, {
          id: `eve:${ctx.session.id}:${event.data.turnId}:${event.data.stepIndex}`,
          role: "assistant",
          parts: [{ type: "text", text: messageText }],
          metadata: mirrorAssistantMetadata(event.data.turnId),
        })
      );
    },
  },
});
