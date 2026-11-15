import { Effect, Option } from "effect";

import { serveFile } from "../serve-file";
import type { ManifestRouteContext } from "../types/routes";
import { markdownAlternatePath } from "../utils/routing";

export const staticFileRoute = Effect.fn("Sites.route.staticFile")(function* ({
  path,
  file,
  twin,
  area,
  loaded,
  markdownNotFoundPath,
  fileParams,
}: ManifestRouteContext) {
  if (!file || path === markdownNotFoundPath) {
    return Option.none<Response>();
  }
  const response = yield* Effect.promise(() =>
    serveFile({
      ...fileParams,
      file,
      extraHeaders: twin
        ? {
            Vary: "Accept",
            Link: `<${markdownAlternatePath(loaded.files, twin.path, area?.mount)}>; rel="alternate"; type="text/markdown"`,
          }
        : undefined,
    })
  );
  return Option.some(response);
});
