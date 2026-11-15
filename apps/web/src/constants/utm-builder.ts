import type {
  Ga4ChannelRule,
  UtmChannelPreset,
  UtmField,
} from "@/types/utm-builder";
import { SITE_URL } from "@/utils/urls";

export const UTM_BUILDER_PATH = "/utm-builder";

export const UTM_BUILDER_URL = `${SITE_URL}${UTM_BUILDER_PATH}`;

export const UTM_BUILDER_MARKDOWN_PATH = `${UTM_BUILDER_PATH}.md`;

export const UTM_BUILDER_MARKDOWN_URL = `${SITE_URL}${UTM_BUILDER_MARKDOWN_PATH}`;

export const UTM_BUILDER_TITLE = "UTM Builder";

export const UTM_BUILDER_DESCRIPTION =
  "Build UTM links that land in the right GA4 channel. Cleans up values as you type, predicts the default channel group, tags one link for every channel at once and shares the whole setup as a link. Free, no sign-up.";

export const UTM_BUILDER_HERO_SUBTITLE =
  "Paste a link, pick where it goes and get a clean UTM link back. We fix casing and spaces, tell you which GA4 channel it will land in and warn you before it ends up in Unassigned.";

export const UTM_BUILDER_URL_DEBOUNCE_MS = 300;

export const UTM_MAX_URL_LENGTH = 2048;

export const UTM_FIELDS: readonly UtmField[] = [
  {
    key: "source",
    param: "utm_source",
    label: "Source",
    placeholder: "newsletter",
    description:
      "Where the click comes from: a site, platform or list. Examples: google, linkedin, newsletter.",
    requirement: "required",
  },
  {
    key: "medium",
    param: "utm_medium",
    label: "Medium",
    placeholder: "email",
    description:
      "The type of traffic. GA4 groups channels mostly by this value. Examples: cpc, email, social, paid-social, affiliate.",
    requirement: "recommended",
  },
  {
    key: "campaign",
    param: "utm_campaign",
    label: "Campaign",
    placeholder: "spring-launch",
    description:
      "The campaign, launch or promotion the link belongs to. Keep it the same across every channel so you can compare them.",
    requirement: "recommended",
  },
  {
    key: "id",
    param: "utm_id",
    label: "Campaign ID",
    placeholder: "q2-2026-001",
    description:
      "A stable ID for the campaign. GA4 needs it to join imported cost data to sessions.",
    requirement: "optional",
  },
  {
    key: "term",
    param: "utm_term",
    label: "Term",
    placeholder: "utm builder",
    description: "The paid keyword or audience that triggered the ad.",
    requirement: "optional",
  },
  {
    key: "content",
    param: "utm_content",
    label: "Content",
    placeholder: "hero-button",
    description:
      "Tells apart links that share everything else, such as two buttons in one email or two ad variants.",
    requirement: "optional",
  },
  {
    key: "platform",
    param: "utm_source_platform",
    label: "Source platform",
    placeholder: "search-ads-360",
    description:
      "The platform that runs the campaign, such as a buying tool or ad manager.",
    requirement: "optional",
    advanced: true,
  },
  {
    key: "format",
    param: "utm_creative_format",
    label: "Creative format",
    placeholder: "video",
    description: "The type of creative, such as display, native or video.",
    requirement: "optional",
    advanced: true,
  },
  {
    key: "tactic",
    param: "utm_marketing_tactic",
    label: "Marketing tactic",
    placeholder: "remarketing",
    description:
      "The targeting applied to the campaign, such as remarketing or prospecting.",
    requirement: "optional",
    advanced: true,
  },
];

export const UTM_CHANNEL_PRESETS: readonly UtmChannelPreset[] = [
  {
    id: "newsletter",
    label: "Newsletter",
    source: "newsletter",
    medium: "email",
  },
  {
    id: "linkedin",
    label: "LinkedIn post",
    source: "linkedin",
    medium: "social",
  },
  { id: "x", label: "X post", source: "x", medium: "social" },
  { id: "reddit", label: "Reddit post", source: "reddit", medium: "social" },
  { id: "youtube", label: "YouTube video", source: "youtube", medium: "video" },
  {
    id: "google-ads",
    label: "Google Ads",
    source: "google",
    medium: "cpc",
    term: "{keyword}",
    content: "{creative}",
    note: "{keyword} and {creative} are ValueTrack parameters Google Ads fills in at click time.",
  },
  {
    id: "meta-ads",
    label: "Meta Ads",
    source: "facebook",
    medium: "paid-social",
    term: "{{adset.name}}",
    content: "{{ad.name}}",
    note: "{{adset.name}} and {{ad.name}} are dynamic parameters Meta fills in at click time.",
  },
  {
    id: "linkedin-ads",
    label: "LinkedIn Ads",
    source: "linkedin",
    medium: "paid-social",
  },
  { id: "bing-ads", label: "Microsoft Ads", source: "bing", medium: "cpc" },
  {
    id: "partner",
    label: "Partner or affiliate",
    source: "partner",
    medium: "affiliate",
  },
  { id: "podcast", label: "Podcast", source: "podcast", medium: "audio" },
  { id: "sms", label: "SMS", source: "sms", medium: "sms" },
];

export const GA4_PAID_MEDIUM_REGEX = /^(.*cp.*|ppc|retargeting|paid.*)$/;

export const GA4_SHOPPING_CAMPAIGN_REGEX =
  /^(.*(([^a-df-z]|^)shop|shopping).*)$/;

export const GA4_EMAIL_REGEX = /^(email|e-mail|e_mail|e mail)$/;

// ponytail: subset of Google's published source category lists, swap in the full CSV if predictions drift
export const GA4_SEARCH_SOURCES = new Set([
  "google",
  "bing",
  "yahoo",
  "duckduckgo",
  "baidu",
  "yandex",
  "ecosia",
  "naver",
  "ask",
  "aol",
  "startpage",
  "qwant",
  "seznam",
  "daum",
  "sogou",
  "google.com",
  "bing.com",
  "search.yahoo.com",
  "duckduckgo.com",
  "yandex.ru",
  "ecosia.org",
]);

export const GA4_SOCIAL_SOURCES = new Set([
  "facebook",
  "fb",
  "instagram",
  "ig",
  "linkedin",
  "lnkd.in",
  "twitter",
  "t.co",
  "x",
  "tiktok",
  "pinterest",
  "reddit",
  "snapchat",
  "threads",
  "bluesky",
  "mastodon",
  "quora",
  "discord",
  "whatsapp",
  "telegram",
  "messenger",
  "tumblr",
  "vk",
  "weibo",
  "wechat",
  "producthunt",
  "news.ycombinator.com",
  "facebook.com",
  "m.facebook.com",
  "l.facebook.com",
  "instagram.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "reddit.com",
  "pinterest.com",
]);

export const GA4_VIDEO_SOURCES = new Set([
  "youtube",
  "youtube.com",
  "m.youtube.com",
  "vimeo",
  "vimeo.com",
  "twitch",
  "twitch.tv",
  "dailymotion",
  "wistia",
  "ted",
]);

export const GA4_SHOPPING_SOURCES = new Set([
  "amazon",
  "amazon.com",
  "ebay",
  "ebay.com",
  "etsy",
  "etsy.com",
  "shopify",
  "shopify.com",
  "walmart",
  "walmart.com",
  "alibaba",
  "aliexpress",
  "google shopping",
  "igshopping",
  "mercadolibre",
  "rakuten",
]);

export const GA4_SOCIAL_MEDIUMS = new Set([
  "social",
  "social-network",
  "social-media",
  "sm",
  "social network",
  "social media",
]);

export const GA4_DISPLAY_MEDIUMS = new Set([
  "display",
  "banner",
  "expandable",
  "interstitial",
  "cpm",
]);

export const GA4_REFERRAL_MEDIUMS = new Set(["referral", "app", "link"]);

export const UTM_MEDIUM_LIKE_VALUES = new Set([
  "email",
  "cpc",
  "ppc",
  "cpm",
  "social",
  "paid-social",
  "organic",
  "display",
  "banner",
  "affiliate",
  "referral",
  "video",
  "audio",
]);

export const GA4_CHANNEL_RULES: readonly Ga4ChannelRule[] = [
  {
    channel: "Direct",
    rule: "Source is (direct) and medium is (none) or (not set).",
  },
  {
    channel: "Cross-network",
    rule: "Campaign name contains cross-network.",
  },
  {
    channel: "Paid Shopping",
    rule: "Source is a shopping site or campaign name contains shop or shopping, and medium is paid.",
  },
  {
    channel: "Paid Search",
    rule: "Source is a search engine and medium is paid.",
  },
  {
    channel: "Paid Social",
    rule: "Source is a social network and medium is paid.",
  },
  {
    channel: "Paid Video",
    rule: "Source is a video site and medium is paid.",
  },
  {
    channel: "Display",
    rule: "Medium is display, banner, expandable, interstitial or cpm.",
  },
  { channel: "Paid Other", rule: "Medium is paid, source is anything else." },
  {
    channel: "Organic Shopping",
    rule: "Source is a shopping site or campaign name contains shop or shopping.",
  },
  {
    channel: "Organic Social",
    rule: "Source is a social network, or medium is social, social-network, social-media, sm, social network or social media.",
  },
  {
    channel: "Organic Video",
    rule: "Source is a video site, or medium contains video.",
  },
  {
    channel: "Organic Search",
    rule: "Source is a search engine, or medium is organic.",
  },
  { channel: "Referral", rule: "Medium is referral, app or link." },
  {
    channel: "Email",
    rule: "Source or medium is email, e-mail, e_mail or e mail.",
  },
  { channel: "Affiliates", rule: "Medium is affiliate." },
  { channel: "Audio", rule: "Medium is audio." },
  { channel: "SMS", rule: "Source or medium is sms." },
  {
    channel: "Mobile Push Notifications",
    rule: "Medium ends with push or contains mobile or notification, or source is firebase.",
  },
  { channel: "Unassigned", rule: "Nothing above matched." },
];

export const GA4_PAID_MEDIUM_NOTE =
  "Paid means the medium matches cp (cpc, cpm, cpv and so on), ppc, retargeting or starts with paid.";

export const UTM_SOURCE_SUGGESTIONS = [
  ...new Set(UTM_CHANNEL_PRESETS.map((preset) => preset.source)),
  "instagram",
  "tiktok",
  "bluesky",
  "producthunt",
  "hackernews",
];

export const UTM_MEDIUM_SUGGESTIONS = [
  ...new Set(UTM_CHANNEL_PRESETS.map((preset) => preset.medium)),
  "display",
  "referral",
  "organic",
  "push",
];

export const UTM_QUICK_FILL_PRESET_IDS = [
  "newsletter",
  "linkedin",
  "x",
  "google-ads",
  "meta-ads",
  "partner",
];
