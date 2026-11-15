import { OpenAPIHono } from "@hono/zod-openapi";
import type { ZodError } from "zod";

import type { ApiEnv } from "../types/env";

export function formatValidationError(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) {
    return "Invalid request";
  }

  const path = issue.path.map(String).join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

function getValidationErrorCode(error: ZodError): string | undefined {
  const issue = error.issues[0];
  if (issue?.code !== "custom") {
    return undefined;
  }
  const code = issue.params?.code;
  return typeof code === "string" ? code : undefined;
}

export function createOpenApiApp() {
  return new OpenAPIHono<ApiEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        const code = getValidationErrorCode(result.error);
        return c.json(
          {
            error: formatValidationError(result.error),
            ...(code ? { code } : {}),
          },
          400
        );
      }
    },
  });
}
