import { escapeSlackText } from "@/utils/autopilot-slack";

/** Plain mrkdwn for `chat.postMessage`, one linked line per created post. */
export function formatContentCreatedSlackText(input: {
  automationName: string;
  contentLink: string;
  posts: Array<{ postId: string; title: string }>;
}) {
  return [
    `*New content from ${escapeSlackText(input.automationName)}*`,
    ...input.posts.map(
      (post) =>
        `• <${input.contentLink}/${post.postId}|${escapeSlackText(post.title)}>`
    ),
    `<${input.contentLink}|Open in Notra>`,
  ].join("\n");
}
