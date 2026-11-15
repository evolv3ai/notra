import {
  GA4_DISPLAY_MEDIUMS,
  GA4_EMAIL_REGEX,
  GA4_PAID_MEDIUM_REGEX,
  GA4_REFERRAL_MEDIUMS,
  GA4_SEARCH_SOURCES,
  GA4_SHOPPING_CAMPAIGN_REGEX,
  GA4_SHOPPING_SOURCES,
  GA4_SOCIAL_MEDIUMS,
  GA4_SOCIAL_SOURCES,
  GA4_VIDEO_SOURCES,
  UTM_CHANNEL_PRESETS,
  UTM_FIELDS,
  UTM_MAX_URL_LENGTH,
  UTM_MEDIUM_LIKE_VALUES,
} from "@/constants/utm-builder";
import { utmDestinationSchema } from "@/schemas/utm-builder";
import type {
  Ga4Classification,
  UtmBuildResult,
  UtmBuilderState,
  UtmChannelLink,
  UtmChannelPreset,
  UtmFieldKey,
  UtmIssue,
  UtmParam,
} from "@/types/utm-builder";

const PLACEHOLDER_SPLIT_REGEX = /(\{\{[^{}]*\}\}|\{[^{}]*\})/;
const PLACEHOLDER_REGEX = /^\{\{?[^{}]*\}?\}$/;
const WHITESPACE_REGEX = /\s+/g;
const REPEATED_DASH_REGEX = /-{2,}/g;
const UPPERCASE_REGEX = /[A-Z]/;
const ENCODED_BRACE_REGEX = /%7B|%7D/g;

type UtmValues = Record<UtmFieldKey, string>;

function cleanSegment(segment: string) {
  return segment
    .toLowerCase()
    .replace(WHITESPACE_REGEX, "-")
    .replace(REPEATED_DASH_REGEX, "-");
}

function cleanUtmValue(value: string) {
  return value
    .trim()
    .split(PLACEHOLDER_SPLIT_REGEX)
    .map((segment) =>
      PLACEHOLDER_REGEX.test(segment) ? segment : cleanSegment(segment)
    )
    .join("");
}

function encodeUtmValue(value: string) {
  return encodeURIComponent(value).replace(ENCODED_BRACE_REGEX, (match) =>
    match === "%7B" ? "{" : "}"
  );
}

function parseDestination(input: string): URL | null {
  const parsed = utmDestinationSchema.safeParse(input);
  return parsed.success ? new URL(parsed.data) : null;
}

function isUtmPair(pair: string) {
  const key = pair.split("=", 1)[0] ?? "";
  try {
    return decodeURIComponent(key.replaceAll("+", " "))
      .toLowerCase()
      .startsWith("utm_");
  } catch {
    return key.toLowerCase().startsWith("utm_");
  }
}

/** Reads the utm_ values already on a pasted link, keyed by builder field. */
function readUtmValues(input: string): Partial<UtmValues> {
  const url = parseDestination(input);
  if (!url) {
    return {};
  }
  return Object.fromEntries(
    UTM_FIELDS.flatMap((field) => {
      const value = url.searchParams.get(field.param);
      return value ? [[field.key, value]] : [];
    })
  );
}

function isPaidMedium(medium: string) {
  return GA4_PAID_MEDIUM_REGEX.test(medium);
}

function isShopping(source: string, campaign: string) {
  return (
    GA4_SHOPPING_SOURCES.has(source) ||
    GA4_SHOPPING_CAMPAIGN_REGEX.test(campaign)
  );
}

export function classifyGa4Channel(
  rawSource: string,
  rawMedium: string,
  rawCampaign: string
): Ga4Classification {
  const source = rawSource.toLowerCase();
  const medium = rawMedium.toLowerCase();
  const campaign = rawCampaign.toLowerCase();
  const paid = isPaidMedium(medium);

  if (
    source === "(direct)" &&
    (medium === "(none)" || medium === "(not set)")
  ) {
    return { channel: "Direct", reason: "Source is (direct)." };
  }
  if (campaign.includes("cross-network")) {
    return {
      channel: "Cross-network",
      reason: "The campaign name contains cross-network.",
    };
  }
  if (paid && isShopping(source, campaign)) {
    return {
      channel: "Paid Shopping",
      reason: `"${medium}" is a paid medium and the source or campaign points to shopping.`,
    };
  }
  if (paid && GA4_SEARCH_SOURCES.has(source)) {
    return {
      channel: "Paid Search",
      reason: `"${source}" is a search engine and "${medium}" is a paid medium.`,
    };
  }
  if (paid && GA4_SOCIAL_SOURCES.has(source)) {
    return {
      channel: "Paid Social",
      reason: `"${source}" is a social network and "${medium}" is a paid medium.`,
    };
  }
  if (paid && GA4_VIDEO_SOURCES.has(source)) {
    return {
      channel: "Paid Video",
      reason: `"${source}" is a video site and "${medium}" is a paid medium.`,
    };
  }
  if (GA4_DISPLAY_MEDIUMS.has(medium)) {
    return { channel: "Display", reason: `"${medium}" is a display medium.` };
  }
  if (paid) {
    return {
      channel: "Paid Other",
      reason: `"${medium}" is a paid medium, but GA4 does not know "${source}" as a search, social, video or shopping source.`,
    };
  }
  if (isShopping(source, campaign)) {
    return {
      channel: "Organic Shopping",
      reason: "The source or campaign points to shopping.",
    };
  }
  if (GA4_SOCIAL_SOURCES.has(source) || GA4_SOCIAL_MEDIUMS.has(medium)) {
    return {
      channel: "Organic Social",
      reason: GA4_SOCIAL_MEDIUMS.has(medium)
        ? `"${medium}" is a social medium.`
        : `"${source}" is a social network.`,
    };
  }
  if (GA4_VIDEO_SOURCES.has(source) || medium.includes("video")) {
    return {
      channel: "Organic Video",
      reason: medium.includes("video")
        ? `"${medium}" contains video.`
        : `"${source}" is a video site.`,
    };
  }
  if (GA4_SEARCH_SOURCES.has(source) || medium === "organic") {
    return {
      channel: "Organic Search",
      reason:
        medium === "organic"
          ? 'The medium is "organic".'
          : `"${source}" is a search engine.`,
    };
  }
  if (GA4_REFERRAL_MEDIUMS.has(medium)) {
    return { channel: "Referral", reason: `"${medium}" is a referral medium.` };
  }
  if (GA4_EMAIL_REGEX.test(source) || GA4_EMAIL_REGEX.test(medium)) {
    return { channel: "Email", reason: "The source or medium is email." };
  }
  if (medium === "affiliate") {
    return { channel: "Affiliates", reason: 'The medium is "affiliate".' };
  }
  if (medium === "audio") {
    return { channel: "Audio", reason: 'The medium is "audio".' };
  }
  if (source === "sms" || medium === "sms") {
    return { channel: "SMS", reason: "The source or medium is sms." };
  }
  if (
    medium.endsWith("push") ||
    medium.includes("mobile") ||
    medium.includes("notification") ||
    source === "firebase"
  ) {
    return {
      channel: "Mobile Push Notifications",
      reason: "The medium points to push notifications.",
    };
  }
  return {
    channel: "Unassigned",
    reason: medium
      ? `GA4 has no rule for the medium "${medium}" with the source "${source}".`
      : "There is no medium, so GA4 has nothing to group on.",
  };
}

function valuesFromState(
  state: UtmBuilderState,
  pasted: Partial<UtmValues>
): UtmValues {
  const pick = (key: UtmFieldKey) => state[key] || pasted[key] || "";
  return {
    source: pick("source"),
    medium: pick("medium"),
    campaign: pick("campaign"),
    id: pick("id"),
    term: pick("term"),
    content: pick("content"),
    platform: pick("platform"),
    format: pick("format"),
    tactic: pick("tactic"),
  };
}

function lintValues(
  values: UtmValues,
  clean: boolean,
  params: UtmParam[]
): UtmIssue[] {
  const issues: UtmIssue[] = [];
  if (!values.source.trim()) {
    issues.push({
      level: "error",
      message:
        "Add a source. utm_source is the one UTM value analytics tools require.",
    });
  }
  if (!values.medium.trim()) {
    issues.push({
      level: "warning",
      message: "Add a medium. GA4 groups traffic into channels by the medium.",
    });
  }
  if (!values.campaign.trim()) {
    issues.push({
      level: "warning",
      message:
        "Add a campaign so you can compare this link with the others in the same push.",
    });
  }
  const source = values.source.trim().toLowerCase();
  const medium = values.medium.trim().toLowerCase();
  if (
    UTM_MEDIUM_LIKE_VALUES.has(source) &&
    medium &&
    !UTM_MEDIUM_LIKE_VALUES.has(medium)
  ) {
    issues.push({
      level: "warning",
      message: `"${source}" looks like a medium and "${medium}" like a source. Did you swap them?`,
    });
  }
  const changed = params.filter((param) => param.input.trim() !== param.value);
  if (clean && changed.length > 0) {
    issues.push({
      level: "info",
      message: `Cleaned up ${changed.map((param) => param.param).join(", ")}: lowercase, no spaces. GA4 treats Email and email as two different values.`,
    });
  }
  const messy = params.filter(
    (param) => UPPERCASE_REGEX.test(param.value) || param.value.includes(" ")
  );
  if (!clean && messy.length > 0) {
    issues.push({
      level: "warning",
      message: `${messy.map((param) => param.param).join(", ")} contain uppercase letters or spaces. GA4 will report them apart from their lowercase twins.`,
    });
  }
  return issues;
}

export function buildUtmLink(
  state: UtmBuilderState,
  overrides: Partial<UtmValues> = {}
): UtmBuildResult {
  const destination = parseDestination(state.url);
  const pasted = readUtmValues(state.url);
  const values = { ...valuesFromState(state, pasted), ...overrides };
  const params: UtmParam[] = UTM_FIELDS.flatMap((field) => {
    const input = values[field.key];
    if (!input.trim()) {
      return [];
    }
    return [
      {
        param: field.param,
        input,
        value: state.clean ? cleanUtmValue(input) : input.trim(),
      },
    ];
  });
  const issues = lintValues(values, state.clean, params);

  if (!state.url.trim()) {
    issues.unshift({
      level: "error",
      message: "Add the page you want to send people to.",
    });
  } else if (!destination) {
    issues.unshift({
      level: "error",
      message: `"${state.url.trim()}" is not a valid http or https link.`,
    });
  }

  const byParam = new Map(params.map((param) => [param.param, param.value]));
  const classification = values.source.trim()
    ? classifyGa4Channel(
        byParam.get("utm_source") ?? "",
        byParam.get("utm_medium") ?? "",
        byParam.get("utm_campaign") ?? ""
      )
    : null;
  if (classification?.channel === "Unassigned") {
    issues.push({
      level: "warning",
      message: `GA4 will put this in Unassigned. ${classification.reason} Try a medium like email, social, cpc, referral or affiliate.`,
    });
  }

  if (!destination || issues.some((issue) => issue.level === "error")) {
    return { url: null, params, classification, issues };
  }

  if (Object.keys(pasted).length > 0) {
    issues.push({
      level: "info",
      message:
        "The link already had UTM values. We replaced them instead of adding duplicates.",
    });
  }

  const kept = destination.search
    .slice(1)
    .split("&")
    .filter((pair) => pair && !isUtmPair(pair));
  const added = params.map(
    (param) => `${param.param}=${encodeUtmValue(param.value)}`
  );
  const query = [...kept, ...added].join("&");
  const url = `${destination.origin}${destination.pathname}${query ? `?${query}` : ""}${destination.hash}`;

  if (url.length > UTM_MAX_URL_LENGTH) {
    issues.push({
      level: "warning",
      message: `The link is ${url.length} characters long. Some email clients and ad platforms cut links over ${UTM_MAX_URL_LENGTH}.`,
    });
  }

  return { url, params, classification, issues };
}

/** Keeps a value the user typed, but swaps one another preset filled in. */
function presetValue(
  current: string,
  key: "term" | "content",
  preset: UtmChannelPreset
) {
  const fromPreset =
    !current ||
    UTM_CHANNEL_PRESETS.some((candidate) => candidate[key] === current);
  return fromPreset ? (preset[key] ?? "") : current;
}

export function presetOverrides(
  state: UtmBuilderState,
  preset: UtmChannelPreset
): Partial<UtmValues> {
  return {
    source: preset.source,
    medium: preset.medium,
    term: presetValue(state.term, "term", preset),
    content: presetValue(state.content, "content", preset),
  };
}

export function buildChannelLinks(state: UtmBuilderState): UtmChannelLink[] {
  const selected = new Set(state.channels);
  return UTM_CHANNEL_PRESETS.filter((preset) => selected.has(preset.id)).map(
    (preset) => ({
      preset,
      result: buildUtmLink(state, presetOverrides(state, preset)),
    })
  );
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function channelLinksCsv(links: readonly UtmChannelLink[]) {
  const rows = [
    ["channel", "utm_source", "utm_medium", "ga4_channel", "url"],
    ...links.map(({ preset, result }) => [
      preset.label,
      preset.source,
      preset.medium,
      result.classification?.channel ?? "",
      result.url ?? "",
    ]),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

/** Splits a pasted link that already carries UTM values into a clean link and the values. */
export function splitTaggedLink(input: string) {
  const values = readUtmValues(input);
  const url = parseDestination(input);
  if (!url || Object.keys(values).length === 0) {
    return null;
  }
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_")) {
      url.searchParams.delete(key);
    }
  }
  return { url: url.toString(), values };
}
