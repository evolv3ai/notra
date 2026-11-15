/**
 * Where the eval lives inside the box. The bundle sits two levels below it
 * (dist/box/evals.mjs) because constants/paths.ts resolves the app dir as
 * ../.. from its own file, so .runs ends up at BOX_APP_DIR/.runs.
 */
export const BOX_APP_DIR = "/workspace/home/evals";
export const BOX_BUNDLE_PATH = `${BOX_APP_DIR}/dist/box/evals.mjs`;
export const BOX_ARGS_PATH = `${BOX_APP_DIR}/args.json`;
export const BOX_LOG_PATH = `${BOX_APP_DIR}/run.log`;
export const BOX_EXIT_PATH = `${BOX_APP_DIR}/exit.code`;
export const BOX_RUNS_DIR = `${BOX_APP_DIR}/.runs`;

export const BOX_NAME_PREFIX = "notra-evals-";
/** Ephemeral boxes delete themselves after this, even if our delete never lands. */
export const BOX_TTL_SECONDS = 3 * 60 * 60;
export const BOX_POLL_INTERVAL_MS = 5000;
export const BOX_REQUEST_TIMEOUT_MS = 60_000;

/**
 * The only host the bundle talks to: model calls, Jev, the price list and
 * the cost lookups all go through the AI Gateway. Nothing is installed in
 * the box, so no package registry is allowed.
 */
export const BOX_ALLOWED_DOMAINS = ["ai-gateway.vercel.sh"];
