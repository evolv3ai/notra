import { isNotFound, isRedirect } from "@tanstack/react-router";
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

const GENERIC_SERVER_ERROR = "Internal server error";

export const functionErrorTelemetry = createMiddleware({
  type: "function",
}).server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (isRedirect(error) || isNotFound(error)) {
      throw error;
    }
    const { onRequestError } = await import("@/instrumentation");
    await onRequestError(error, getRequest()).catch((captureError) => {
      console.error(
        "[telemetry] server function error capture failed",
        captureError
      );
    });
    throw import.meta.env.PROD ? new Error(GENERIC_SERVER_ERROR) : error;
  }
});
