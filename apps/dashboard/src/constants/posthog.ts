import { isDemoModeClient } from "@notra/utils/demo-mode";
import type { PostHogConfig } from "posthog-js";

import {
  redactPostHogEvent,
  redactPostHogNetworkRequest,
  resolvePostHogUiHost,
} from "@/utils/posthog";

export const POSTHOG_PROJECT_TOKEN = isDemoModeClient()
  ? undefined
  : process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

const POSTHOG_INGEST_PATH = "/ingest";

const POSTHOG_UPSTREAM_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

export const POSTHOG_CONFIG = {
  api_host: POSTHOG_INGEST_PATH,
  ui_host: resolvePostHogUiHost(POSTHOG_UPSTREAM_HOST),
  autocapture: false,
  before_send: redactPostHogEvent,
  capture_dead_clicks: true,
  capture_exceptions: true,
  capture_pageleave: true,
  capture_pageview: "history_change",
  // Nothing is stored until the consent banner grants measurement; a refusal
  // keeps counting the visitor with PostHog's server-side cookieless hash.
  cookieless_mode: "on_reject",
  defaults: "2026-05-30",
  disable_capture_url_hashes: true,
  disable_surveys: true,
  enable_recording_console_log: true,
  person_profiles: "identified_only",
  save_campaign_params: false,
  save_referrer: false,
  // Replays only start after measurement consent. Sampling and canvas
  // capture follow the PostHog project settings. Inputs stay masked; mark
  // anything else that shows secrets with `ph-no-capture`.
  session_recording: {
    maskAllInputs: true,
    maskCapturedNetworkRequestFn: redactPostHogNetworkRequest,
    recordBody: false,
    recordHeaders: false,
  },
} satisfies Partial<PostHogConfig>;
