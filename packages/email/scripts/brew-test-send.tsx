import type { ReactElement } from "react";

import type { BrewEmailCategory } from "../src/types/brew";
import { isBrewConfigured, sendBrewEmail } from "../src/utils/brew";

const toIndex = process.argv.indexOf("--to");
const to = toIndex === -1 ? undefined : process.argv[toIndex + 1];
if (!to) {
  throw new Error("Pass a recipient with --to");
}

if (!isBrewConfigured()) {
  throw new Error("BREW_API_KEY is not set");
}

process.env.NEXT_PUBLIC_SITE_URL = "https://usenotra.com";
process.env.NEXT_PUBLIC_APP_URL = "https://app.usenotra.com";
const { EMAIL_SAMPLES } = await import("./email-samples");

const runId = Date.now();

for (const [category, [subject, react]] of Object.entries(EMAIL_SAMPLES) as [
  BrewEmailCategory,
  [string, ReactElement],
][]) {
  const result = await sendBrewEmail({
    category,
    to,
    subject: `[Test] ${subject}`,
    react,
    idempotencyKey: `test-send:${category}:${runId}`,
  });

  console.log(
    result.error
      ? `✗ ${category}: ${result.error.name} ${result.error.message}`
      : `✓ ${category}: ${result.data?.id}`
  );
}
