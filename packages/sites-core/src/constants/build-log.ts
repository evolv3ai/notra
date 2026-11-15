const ESCAPE = String.fromCharCode(27);
const BELL = String.fromCharCode(7);
// OSC bodies exclude ESC/BEL so an unterminated sequence stops at the next
// escape instead of rescanning the rest of the log. ESC ( B and friends are
// character-set designations, as in tput sgr0.
export const ANSI_SEQUENCE = new RegExp(
  `${ESCAPE}\\][^${ESCAPE}${BELL}]*(?:${BELL}|${ESCAPE}\\\\)|${ESCAPE}\\[[0-?]*[ -/]*[@-~]|${ESCAPE}[()*+][0-9A-Za-z]`,
  "g"
);

export const TIMESTAMP_PREFIX = /^(\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?) (.*)$/;
export const ERROR_LINE =
  /\[error\]|\berror\b|\bERR!|\bbuild failed\b|✘|✖|^\s*×\s+/i;
export const LOG_STATUS_PREFIX = /^\s*[✘✖×]\s+/;
export const WARNING_LINE = /\[warn\]|\bwarn(?:ing)?\b/i;
export const SUCCESS_LINE = /[✓✔]/;
export const CONTINUATION_LINE = /^[\s│╭╰─┬┴├└┌]/;
export const LINE_BREAK = /\r?\n/;
export const NOISE_LINE = /^\s*(?:[├└│]|at\s)/;
export const TAG_PREFIX = /^(\[[\w:@/-]+\])\s?(.*)$/;
export const CLOCK = /^(\d{2}):(\d{2}):(\d{2})/;
export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_HOUR = 3600;
export const SECONDS_PER_DAY = 86_400;
export const STACK_FRAME = /^\s+at\s/;
export const SITE_BUILD_LOG_FRAME_FOLD_MIN = 3;
export const SITE_BUILD_LOG_NOISE_FOLD_MIN = 6;
export const SITE_BUILD_LOG_NOISE_KEEP = 2;
