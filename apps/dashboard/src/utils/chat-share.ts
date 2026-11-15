import { CHAT_SHARE_PATH_PREFIX } from "@/constants/chat-share";

const WORD_BOUNDARY_REGEX = /([a-z0-9])([A-Z])|[_\-.]+/g;

/** `webSearch` and `linear_list_issues` read as "Web search", "Linear list issues". */
export function humanizeToolName(name: string) {
  const words = name
    .replace(WORD_BOUNDARY_REGEX, (_match, before?: string, after?: string) =>
      before && after ? `${before} ${after}` : " "
    )
    .trim()
    .toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : name;
}

export function chatShareUrl(origin: string, shareId: string) {
  return `${origin}${CHAT_SHARE_PATH_PREFIX}${shareId}`;
}
