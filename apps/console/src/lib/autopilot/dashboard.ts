import "server-only";
import type * as z from "zod";

import {
  AUTOPILOT_ADMIN_PATH,
  AUTOPILOT_ADMIN_REQUEST_TIMEOUT_MS,
} from "@/constants/autopilot";
import { internalServerError, notFound } from "@/lib/orpc/utils/errors";
import type { AutopilotAdminRequest } from "@/types/autopilot";

/** Never sends the internal credential or unvalidated dashboard data to the browser. */
export async function callAutopilotAdmin<T extends z.ZodType>(
  input: AutopilotAdminRequest,
  schema: T
): Promise<z.infer<T>> {
  const baseUrl = process.env.NOTRA_DASHBOARD_URL;
  const secret = process.env.INTERNAL_WORKFLOW_SECRET;
  if (!baseUrl || !secret) {
    throw internalServerError(
      "The Autopilot admin connection is not configured"
    );
  }
  const response = await fetch(new URL(AUTOPILOT_ADMIN_PATH, baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(input),
    cache: "no-store",
    signal: AbortSignal.timeout(AUTOPILOT_ADMIN_REQUEST_TIMEOUT_MS),
  }).catch(() => {
    throw internalServerError("Could not reach the Notra dashboard");
  });
  if (response.status === 404) {
    throw notFound("Autopilot run not found");
  }
  if (!response.ok) {
    throw internalServerError("Could not load Autopilot activity");
  }
  const parsed = schema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    throw internalServerError(
      "The dashboard returned an invalid Autopilot response"
    );
  }
  return parsed.data;
}
