import { logWarn } from "@notra/ai/utils/server-log";
import { getCookie, getRequest } from "@tanstack/react-start/server";
import { waitUntil } from "@vercel/functions";
import { createConsentKernel } from "c15t";
import { Effect } from "effect";

import {
  DUB_CLICK_ID_COOKIE,
  DUB_REQUEST_TIMEOUT_MS,
  DUB_SIGN_UP_EVENT,
  DUB_TRACK_LEAD_URL,
} from "@/constants/dub";
import { resolveDashboardConsent } from "@/lib/consent-manager/resolve";
import { getLocale } from "@/lib/i18n/server";
import type { DubLeadInput, DubLeadRequest } from "@/types/analytics/dub";

const hasMeasurementConsent = Effect.fn("analytics.dub.hasMeasurementConsent")(
  function* ({ request, locale }: Pick<DubLeadRequest, "request" | "locale">) {
    const consent = yield* Effect.tryPromise(async () =>
      resolveDashboardConsent(locale, request)
    );
    return (
      consent !== null &&
      createConsentKernel(consent).getSnapshot().effectivePermissions
        .measurement
    );
  }
);

const sendDubLead = Effect.fn("analytics.dub.sendLead")(function* ({
  apiKey,
  clickId,
  request,
  locale,
  customerExternalId,
  customerName,
  customerEmail,
}: DubLeadRequest) {
  if (!(yield* hasMeasurementConsent({ request, locale }))) {
    return;
  }

  const response = yield* Effect.tryPromise(async () =>
    fetch(DUB_TRACK_LEAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clickId,
        eventName: DUB_SIGN_UP_EVENT,
        customerExternalId,
        customerName,
        customerEmail,
      }),
      signal: AbortSignal.timeout(DUB_REQUEST_TIMEOUT_MS),
    })
  );
  if (!response.ok) {
    logWarn("Dub track lead failed", {
      customerExternalId,
      status: response.status,
    });
  }
});

export const trackDubLead = Effect.fn("analytics.dub.trackLead")(function* (
  input: DubLeadInput
) {
  const apiKey = process.env.DUB_API_KEY;
  const clickId = getCookie(DUB_CLICK_ID_COOKIE);
  if (!(apiKey && clickId)) {
    return;
  }

  const lead: DubLeadRequest = {
    ...input,
    apiKey,
    clickId,
    request: getRequest(),
    locale: yield* Effect.promise(() => getLocale()),
  };

  yield* Effect.sync(() =>
    waitUntil(
      Effect.runPromise(
        sendDubLead(lead).pipe(
          Effect.catch((error) =>
            Effect.sync(() =>
              logWarn("Failed to track Dub lead", {
                customerExternalId: input.customerExternalId,
                error: String(error),
              })
            )
          )
        )
      )
    )
  );
});
