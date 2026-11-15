export const EVALUATION_MODEL_ID = "typesafe-ai/jev-1.14.0";

/** Set to `off`, `false` or `0` to route every classifier back to its LLM. */
export const EVALUATION_FLAG_ENV = "NOTRA_JEV_CLASSIFIERS";

export const EVALUATION_DEFAULT_TIMEOUT_MS = 5000;
export const EVALUATION_BOOLEAN_THRESHOLD = 0.5;
