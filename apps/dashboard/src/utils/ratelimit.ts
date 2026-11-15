import { getClientIp as getTrustedClientIp } from "@notra/utils/client-ip";
import { createLimiter } from "@notra/utils/ratelimit";
import type { Limiter } from "@notra/utils/types/ratelimit";
import { getRequestHeaders as headers } from "@tanstack/react-start/server";

import { COMPANY_LOGO_RATE_LIMIT_PER_USER_PER_MINUTE } from "@/constants/company-logo";
import {
  DEMO_SANDBOX_CREATE_LIMIT,
  DEMO_SANDBOX_CREATE_WINDOW,
  DEMO_SANDBOX_RESET_LIMIT,
  DEMO_SANDBOX_RESET_WINDOW,
  DEMO_SANDBOX_TIME_ZONE_LIMIT,
  DEMO_SANDBOX_TIME_ZONE_WINDOW,
} from "@/constants/demo";

export const ratelimit = {
  fetchTweet: createLimiter({
    prefix: "ratelimit:fetch-tweet",
    requests: 30,
    window: "1m",
  }),
  importTweets: createLimiter({
    prefix: "ratelimit:import-tweets",
    requests: 20,
    window: "1m",
  }),
  mcpConnection: createLimiter({
    prefix: "ratelimit:mcp-connection",
    requests: 10,
    window: "1m",
  }),
  githubProbe: createLimiter({
    prefix: "ratelimit:github-probe",
    requests: 30,
    window: "1m",
  }),
  githubAppRepositories: createLimiter({
    prefix: "ratelimit:github-app-repositories",
    requests: 60,
    window: "1m",
  }),
  githubAppCallback: createLimiter({
    prefix: "ratelimit:github-app-callback",
    requests: 10,
    window: "1m",
  }),
  githubPublish: createLimiter({
    prefix: "ratelimit:github-publish",
    requests: 10,
    window: "1m",
  }),
  granolaConnection: createLimiter({
    prefix: "ratelimit:granola-connection",
    requests: 10,
    window: "1m",
  }),
  internalWorkflowStart: createLimiter({
    prefix: "ratelimit:internal-workflow-start",
    requests: 30,
    window: "1m",
  }),
  onboardingBrandAnalysis: createLimiter({
    prefix: "ratelimit:onboarding-brand-analysis",
    requests: 2,
    window: "10m",
  }),
  onboardingWebsiteCheck: createLimiter({
    prefix: "ratelimit:onboarding-website-check",
    requests: 30,
    window: "1m",
  }),
  companyLogo: createLimiter({
    prefix: "ratelimit:company-logo",
    requests: COMPANY_LOGO_RATE_LIMIT_PER_USER_PER_MINUTE,
    window: "1m",
  }),
  onboardingAgent: createLimiter({
    prefix: "ratelimit:onboarding-agent",
    requests: 2,
    window: "10m",
  }),
  commandPaletteNavigate: createLimiter({
    prefix: "ratelimit:cmdk-navigate",
    requests: 15,
    window: "1m",
  }),
  chatStream: createLimiter({
    prefix: "ratelimit:chat-stream",
    requests: 30,
    window: "1m",
  }),
  chatStop: createLimiter({
    prefix: "ratelimit:chat-stop",
    requests: 30,
    window: "1m",
  }),
  chatRelay: createLimiter({
    prefix: "ratelimit:chat-relay",
    requests: 20,
    window: "1m",
  }),
  slackOAuth: createLimiter({
    prefix: "ratelimit:slack-oauth",
    requests: 10,
    window: "10m",
  }),
  inthOAuth: createLimiter({
    prefix: "ratelimit:inth-oauth",
    requests: 10,
    window: "10m",
  }),
  gscOAuth: createLimiter({
    prefix: "ratelimit:gsc-oauth",
    requests: 10,
    window: "10m",
  }),
  geoWriterPlan: createLimiter({
    prefix: "ratelimit:geo-writer-plan",
    requests: 10,
    window: "10m",
  }),
  geoSequenceRun: createLimiter({
    prefix: "ratelimit:geo-sequence-run",
    requests: 10,
    window: "10m",
  }),
  geoSequencesGenerate: createLimiter({
    prefix: "ratelimit:geo-sequences-generate",
    requests: 5,
    window: "10m",
  }),
  geoPersonasGenerate: createLimiter({
    prefix: "ratelimit:geo-personas-generate",
    requests: 5,
    window: "10m",
  }),
  geoPersonaRun: createLimiter({
    prefix: "ratelimit:geo-persona-run",
    requests: 10,
    window: "10m",
  }),
  geoCompetitorSuggestions: createLimiter({
    prefix: "ratelimit:geo-competitor-suggestions",
    requests: 10,
    window: "10m",
  }),
  geoBrandSearch: createLimiter({
    prefix: "ratelimit:geo-brand-search",
    requests: 60,
    window: "1m",
  }),
  geoShelfPreview: createLimiter({
    prefix: "ratelimit:geo-shelf-preview",
    requests: 30,
    window: "1m",
  }),
  gscSync: createLimiter({
    prefix: "ratelimit:gsc-sync",
    requests: 5,
    window: "10m",
  }),
  signIn: createLimiter({
    prefix: "ratelimit:auth-sign-in",
    requests: 5,
    window: "1m",
  }),
  signUp: createLimiter({
    prefix: "ratelimit:auth-sign-up",
    requests: 5,
    window: "1m",
  }),
  forgotPassword: createLimiter({
    prefix: "ratelimit:auth-forgot-password",
    requests: 3,
    window: "1m",
  }),
  socialSignInStart: createLimiter({
    prefix: "ratelimit:auth-social-start",
    requests: 10,
    window: "1m",
  }),
  mfaVerify: createLimiter({
    analytics: true,
    prefix: "ratelimit:auth-mfa-verify",
    requests: 5,
    window: "1m",
  }),
  demoSandboxCreate: createLimiter({
    prefix: "ratelimit:demo-sandbox-create",
    requests: DEMO_SANDBOX_CREATE_LIMIT,
    window: DEMO_SANDBOX_CREATE_WINDOW,
  }),
  demoSandboxReset: createLimiter({
    prefix: "ratelimit:demo-sandbox-reset",
    requests: DEMO_SANDBOX_RESET_LIMIT,
    window: DEMO_SANDBOX_RESET_WINDOW,
  }),
  demoSandboxTimeZone: createLimiter({
    prefix: "ratelimit:demo-sandbox-time-zone",
    requests: DEMO_SANDBOX_TIME_ZONE_LIMIT,
    window: DEMO_SANDBOX_TIME_ZONE_WINDOW,
  }),
  backupCode: createLimiter({
    analytics: true,
    prefix: "ratelimit:auth-backup-code",
    requests: 5,
    window: "10m",
  }),
};

/** The trusted client IP, or one shared "unknown" bucket when there is none. */
export function getClientIpFromHeaders(headersList: Headers): string {
  return getTrustedClientIp(headersList) ?? "unknown";
}

export function getClientIp(request: Request): string {
  return getClientIpFromHeaders(request.headers);
}

export async function isRateLimited(
  limiter: Limiter,
  key: string
): Promise<boolean> {
  const headersList = await headers();
  const ip = getClientIpFromHeaders(headersList);
  const { success } = await limiter.limit(`${ip}:${key.toLowerCase()}`);
  return !success;
}

export async function isAccountRateLimited(
  limiter: Limiter,
  key: string
): Promise<boolean> {
  const { success } = await limiter.limit(key.toLowerCase());
  return !success;
}
