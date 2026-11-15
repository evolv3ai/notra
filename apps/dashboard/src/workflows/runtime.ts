import { setLogFlushScheduler } from "@notra/ai/evlog";
import { waitUntil } from "@vercel/functions";

import { register } from "@/instrumentation";

setLogFlushScheduler((flush) => {
  waitUntil(Promise.resolve().then(flush));
});
register().catch((error: unknown) => {
  console.error("[telemetry] workflow runtime registration failed", error);
});
