import { createLoader } from "nuqs/server";

import {
  GA4_CHANNEL_RULES,
  GA4_PAID_MEDIUM_NOTE,
  UTM_BUILDER_MARKDOWN_URL,
  UTM_BUILDER_TITLE,
  UTM_BUILDER_URL,
  UTM_CHANNEL_PRESETS,
  UTM_FIELDS,
} from "@/constants/utm-builder";
import {
  buildChannelLinks,
  buildUtmLink,
  classifyGa4Channel,
} from "@/lib/utm-builder/build";
import { serializeUtmBuilder, utmBuilderParsers } from "@/schemas/utm-builder";
import type {
  UtmBuildResult,
  UtmBuilderState,
  UtmIssue,
} from "@/types/utm-builder";
import { markdownResponse } from "@/utils/http";
import { markdownSection } from "@/utils/markdown";

const ISSUE_LABELS: Record<UtmIssue["level"], string> = {
  error: "Error",
  warning: "Warning",
  info: "Note",
};

const EXAMPLE_QUERY =
  "url=example.com/pricing&source=newsletter&medium=email&campaign=spring-launch";

function cell(value: string) {
  return value.replaceAll("|", "\\|");
}

function issueLines(issues: readonly UtmIssue[]) {
  return issues.map(
    (issue) => `- **${ISSUE_LABELS[issue.level]}:** ${issue.message}`
  );
}

function resultLines(state: UtmBuilderState, result: UtmBuildResult) {
  const lines: string[] = [];
  if (result.url) {
    lines.push("Tagged link:", "", "```text", result.url, "```", "");
  } else {
    lines.push("No link yet. Fix the errors below and call again.", "");
  }
  if (result.classification) {
    lines.push(
      `Predicted GA4 channel: **${result.classification.channel}**. ${result.classification.reason}`,
      ""
    );
  }
  if (result.params.length > 0) {
    lines.push(
      "| Parameter | You sent | Value used |",
      "| --- | --- | --- |",
      ...result.params.map(
        (param) =>
          `| \`${param.param}\` | ${cell(param.input)} | \`${cell(param.value)}\` |`
      ),
      ""
    );
  }
  if (result.issues.length > 0) {
    lines.push(...issueLines(result.issues), "");
  }
  lines.push(
    `Open in the builder: ${serializeUtmBuilder(UTM_BUILDER_URL, state)}`,
    `This result as Markdown: ${serializeUtmBuilder(UTM_BUILDER_MARKDOWN_URL, state)}`
  );
  return lines;
}

function channelLinkLines(state: UtmBuilderState) {
  const links = buildChannelLinks(state);
  if (links.length === 0) {
    return [];
  }
  return [
    markdownSection("Links per channel", [
      "| Channel | Source / medium | GA4 channel | Link |",
      "| --- | --- | --- | --- |",
      ...links.map(
        ({ preset, result }) =>
          `| ${preset.label} | ${preset.source} / ${preset.medium} | ${result.classification?.channel ?? "-"} | ${result.url ? `\`${result.url}\`` : (result.issues.find((issue) => issue.level === "error")?.message ?? "-")} |`
      ),
    ]),
  ];
}

function parameterTable() {
  return [
    "| Query key | UTM parameter | Need | What it is |",
    "| --- | --- | --- | --- |",
    "| `url` | (destination) | Required | The page to send people to. `https://` is added when missing. Existing query parameters and the `#fragment` are kept, existing `utm_` parameters are replaced. |",
    ...UTM_FIELDS.map(
      (field) =>
        `| \`${field.key}\` | \`${field.param}\` | ${field.requirement[0]?.toUpperCase()}${field.requirement.slice(1)} | ${field.description} |`
    ),
    "| `channels` | (several links) | Optional | Comma-separated preset IDs from the table below. Returns one tagged link per channel, sharing campaign, ID and the other values. |",
    "| `clean` | (behaviour) | Optional | `true` by default: lowercase values and turn spaces into dashes. Placeholders in `{braces}` are left alone. Send `false` to keep values as typed. |",
  ];
}

function presetTable() {
  return [
    "| Preset ID | Channel | utm_source | utm_medium | Extras | GA4 channel |",
    "| --- | --- | --- | --- | --- | --- |",
    ...UTM_CHANNEL_PRESETS.map((preset) => {
      const { channel } = classifyGa4Channel(preset.source, preset.medium, "");
      const extras = [
        preset.term ? `utm_term=\`${preset.term}\`` : "",
        preset.content ? `utm_content=\`${preset.content}\`` : "",
      ]
        .filter(Boolean)
        .join(", ");
      return `| \`${preset.id}\` | ${preset.label} | ${preset.source} | ${preset.medium} | ${extras || "-"} | ${channel} |`;
    }),
  ];
}

const loadUtmBuilderState = createLoader(utmBuilderParsers);

function hasInput(state: UtmBuilderState) {
  return Boolean(
    state.url ||
    state.channels.length > 0 ||
    UTM_FIELDS.some((field) => state[field.key])
  );
}

function buildUtmBuilderMarkdown(
  state: UtmBuilderState,
  result: UtmBuildResult | null
): string {
  return [
    `# ${UTM_BUILDER_TITLE}`,
    "",
    "Build UTM-tagged links that land in the right GA4 channel. This page is the builder: pass the values as query parameters and it answers with the tagged link, the GA4 channel it will be grouped under and anything that will break your reports. No key, no sign-up, nothing is stored.",
    "",
    ...(result ? [markdownSection("Result", resultLines(state, result))] : []),
    ...channelLinkLines(state),
    markdownSection("How to call it", [
      `GET \`${UTM_BUILDER_MARKDOWN_URL}?${EXAMPLE_QUERY}\``,
      "",
      `The same query on \`${UTM_BUILDER_URL}\` opens the builder with every field filled in, so you can hand a person a link to check before they publish. Requests to \`${UTM_BUILDER_URL}\` with \`Accept: text/markdown\` get this page.`,
      "",
      "Tag one campaign for several channels in one call:",
      "",
      `GET \`${UTM_BUILDER_MARKDOWN_URL}?url=example.com&campaign=spring-launch&channels=newsletter,linkedin,google-ads\``,
      "",
      "URL-encode the `url` value when it has its own `?`, `&` or `#`, otherwise those parts are read as builder parameters.",
      "",
      "Errors keep the link out of the result and come back with status 422. Warnings still return a link.",
    ]),
    markdownSection("Parameters", parameterTable()),
    markdownSection("Channel presets", [
      ...presetTable(),
      "",
      ...UTM_CHANNEL_PRESETS.flatMap((preset) =>
        preset.note ? [`- ${preset.label}: ${preset.note}`] : []
      ),
    ]),
    markdownSection("How GA4 assigns a channel", [
      "GA4 checks these rules from top to bottom and stops at the first match. Values are compared in lowercase, so clean values give stable results.",
      "",
      "| Order | Channel | Rule |",
      "| --- | --- | --- |",
      ...GA4_CHANNEL_RULES.map(
        (rule, index) => `| ${index + 1} | ${rule.channel} | ${rule.rule} |`
      ),
      "",
      GA4_PAID_MEDIUM_NOTE,
      "",
      "Search engine, social network, video and shopping sources come from lists Google maintains. This builder checks the common entries, so a niche source may land in a different channel than predicted.",
    ]),
    markdownSection("Naming rules that keep reports clean", [
      "- Use lowercase everywhere. `Email`, `email` and `EMAIL` are three rows in GA4.",
      "- Use dashes instead of spaces. Spaces turn into `%20` or `+` and are easy to mistype.",
      "- Keep the source the site or list, and the medium the type of traffic. `source=newsletter&medium=email`, not the other way round.",
      "- Reuse one campaign name across every channel of a push and tell links apart with `utm_content`.",
      "- Never tag internal links between pages of your own site. It starts a new session and overwrites where the visitor really came from.",
      "- Add `utm_id` when you import cost data into GA4. It is the key the import joins on.",
    ]),
  ].join("\n");
}

export function serveUtmBuilderMarkdown(request: Request) {
  const state = loadUtmBuilderState(request.url);
  const links = buildChannelLinks(state);
  const channelsOnly = links.length > 0 && !state.source.trim();
  const result = hasInput(state) && !channelsOnly ? buildUtmLink(state) : null;
  const failed =
    result?.issues.some((issue) => issue.level === "error") ||
    (links.length > 0 && links.every((link) => link.result.url === null));
  return markdownResponse(
    buildUtmBuilderMarkdown(state, result),
    failed ? 422 : 200
  );
}
