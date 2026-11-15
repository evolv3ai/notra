import { shouldBypassAutumnInDevelopment } from "@notra/ai/utils/autumn-development";
import { isDemoMode } from "@notra/utils/demo-mode";

const REQUIRED_ENV_VARS = [
  "UNKEY_ROOT_KEY",
  "DATABASE_URL",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "WORKFLOW_BASE_URL",
  "INTEGRATION_ENCRYPTION_KEY",
] as const;

export function assertRequiredEnv() {
  const required: string[] = [...REQUIRED_ENV_VARS];
  if (!isDemoMode()) {
    required.push("QSTASH_TOKEN");
  }
  if (
    !shouldBypassAutumnInDevelopment(
      process.env.NODE_ENV,
      process.env.AUTUMN_SECRET_KEY
    )
  ) {
    required.push("AUTUMN_SECRET_KEY");
  }
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}
