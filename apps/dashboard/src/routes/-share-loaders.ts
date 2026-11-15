import { isDemoMode } from "@notra/utils/demo-mode";
import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { CHAT_SHARE_ID_LENGTH } from "@/constants/chat-share";
import type { UiRouteInput } from "@/types/ui-route";

const SHARE_ID_PATTERN = new RegExp(`^[A-Za-z0-9_-]{${CHAT_SHARE_ID_LENGTH}}$`);

export const loadSharedChat = createServerFn({ method: "GET" })
  .validator((data: UiRouteInput) => data)
  .handler(async ({ data: { params } }) => {
    const shareId = params.id ?? "";
    if (isDemoMode() || !SHARE_ID_PATTERN.test(shareId)) {
      throw notFound();
    }
    const { getPublicChatShare } = await import("@/lib/chat/shares");
    const share = await getPublicChatShare(shareId);
    if (!share) {
      throw notFound();
    }
    return share;
  });
