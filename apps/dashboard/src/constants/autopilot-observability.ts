export const AUTOPILOT_ADMIN_TRACE_EVENT_LIMIT = 500;
export const AUTOPILOT_SECRET_FIELD =
  /^(?:authorization|cookies?|set-cookie|token)$|password|secret|api[-_]?key|private[-_]?key|(?:access|refresh|id|auth|github|slack|bot)[-_]?token$/i;
export const AUTOPILOT_SECRET_VALUE =
  /(?:\bBearer\s+[^\s"']+|\b(?:sk-[a-zA-Z0-9_-]{12,}|gh[pousr]_[a-zA-Z0-9_]{12,}|github_pat_[a-zA-Z0-9_]{12,}|xox[baprs]-[a-zA-Z0-9-]{12,})|postgres(?:ql)?:\/\/[^\s"']+|[?&](?:access_token|api_key|token|client_secret)=[^\s&"']+)/gi;
