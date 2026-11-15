import { readFileSync } from "node:fs";

import { runHeadless, type HeadlessArgs } from "./headless";

/**
 * Entry of the bundle that runs inside an Upstash Box. Arguments come from a
 * JSON file the host uploads, so nothing is parsed twice and no repo .env is
 * read: the box only has AI_GATEWAY_API_KEY in its environment.
 */
const argsPath = process.argv[2];
if (!argsPath) {
  console.error("Usage: node evals.mjs <args.json>");
  process.exit(1);
}
const args = JSON.parse(readFileSync(argsPath, "utf8")) as HeadlessArgs;
process.exit(await runHeadless(args));
