import { logError } from "@notra/ai/utils/server-log";
import type { Effect } from "effect";

import {
  SOCIAL_DUPLICATE_CONTENT_CODE,
  SOCIAL_DUPLICATE_CONTENT_REGEX,
} from "@/constants/social-connect";
import { getTranslations } from "@/lib/i18n/server";
import { runOrpcEffect } from "@/lib/orpc/effect";
import {
  assertNotDemo,
  badRequest,
  paymentRequired,
  serviceUnavailable,
} from "@/lib/orpc/utils/errors";
import {
  getSocialConnectStatusCode,
  type SocialConnectConfigError,
  type SocialConnectDeliveryUnknownError,
  type SocialConnectRequestError,
} from "@/lib/social-connect/errors";

type SocialConnectFailure =
  | SocialConnectConfigError
  | SocialConnectDeliveryUnknownError
  | SocialConnectRequestError;

interface RunSocialConnectOptions {
  logLabel: string;
  reconnectHint?: boolean;
}

async function toSocialConnectOrpcError(
  error: SocialConnectFailure,
  options: RunSocialConnectOptions
): Promise<Error> {
  if (error._tag === "SocialConnectConfigError") {
    assertNotDemo();
    const tCommonErrors = await getTranslations("common.errors");
    return serviceUnavailable(tCommonErrors("generic"));
  }

  logError(options.logLabel, error);
  const tErrors = await getTranslations("errors.socialAccounts");
  if (error._tag === "SocialConnectDeliveryUnknownError") {
    return serviceUnavailable(tErrors("deliveryUnknown"));
  }
  const statusCode = getSocialConnectStatusCode(error.cause);

  if (options.reconnectHint && (statusCode === 401 || statusCode === 403)) {
    return badRequest(tErrors("notAuthorizedToPost"), {
      code: "reconnect_required",
    });
  }
  const providerMessage =
    error.cause instanceof Error ? error.cause.message : error.message;
  if (SOCIAL_DUPLICATE_CONTENT_REGEX.test(providerMessage)) {
    return badRequest(tErrors("duplicateContent"), {
      code: SOCIAL_DUPLICATE_CONTENT_CODE,
    });
  }
  if (statusCode === 402) {
    return paymentRequired(tErrors("requestRejected"));
  }
  if (statusCode !== null && statusCode >= 400 && statusCode < 500) {
    return badRequest(tErrors("requestRejected"));
  }
  return serviceUnavailable(tErrors("serviceUnavailable"));
}

export function runSocialConnect<A>(
  effect: Effect.Effect<A, SocialConnectFailure>,
  options: RunSocialConnectOptions
): Promise<A> {
  return runOrpcEffect(effect, (error) =>
    toSocialConnectOrpcError(error, options)
  );
}
