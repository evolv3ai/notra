import { Effect, Option } from "effect";

import { serveFile } from "../serve-file";
import type { ManifestRouteContext } from "../types/routes";
import { markdownPageHeaders } from "../utils/markdown-headers";

export const markdownTwinRoute = Effect.fn("Sites.route.markdownTwin")(
  function* ({
    twin,
    wantsMarkdown,
    loaded,
    fileParams,
  }: ManifestRouteContext) {
    if (!(twin && wantsMarkdown)) {
      return Option.none<Response>();
    }
    const response = yield* Effect.promise(() =>
      serveFile({
        ...fileParams,
        file: twin,
        extraHeaders: {
          Vary: "Accept",
          "Content-Location": twin.path,
          ...markdownPageHeaders(
            loaded.manifest.target.publicOrigin,
            twin.path
          ),
        },
      })
    );
    return Option.some(response);
  }
);
