import { Effect, Option } from "effect";

import { SECURITY_TXT_MAX_AGE_SECONDS } from "../constants/responses";
import { hostingApexPage, securityTxt } from "../pages";
import type { RequestRouteContext } from "../types/routes";
import { html, plainText } from "../utils/responses";

export const hostingApexRoute = ({
  deps,
  url,
  host,
}: RequestRouteContext): Effect.Effect<Option.Option<Response>> =>
  Effect.sync(() => {
    if (host !== deps.hostingDomain && host !== `www.${deps.hostingDomain}`) {
      return Option.none();
    }
    if (url.pathname === "/.well-known/security.txt") {
      return Option.some(
        plainText(
          securityTxt(url.origin, deps.now()),
          SECURITY_TXT_MAX_AGE_SECONDS
        )
      );
    }
    return Option.some(html(hostingApexPage(deps.hostingDomain), 200));
  });
