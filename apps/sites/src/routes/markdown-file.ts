import { Effect, Option } from "effect";

import { serveFile } from "../serve-file";
import type { ManifestRouteContext } from "../types/routes";
import { markdownPageHeaders } from "../utils/markdown-headers";
import { resolveMarkdownFile } from "../utils/routing";

export const markdownFileRoute = Effect.fn("Sites.route.markdownFile")(
  function* ({
    path,
    loaded,
    markdownNotFoundPath,
    fileParams,
  }: ManifestRouteContext) {
    const markdownFile = resolveMarkdownFile(loaded.files, path);
    if (!markdownFile || path === markdownNotFoundPath) {
      return Option.none<Response>();
    }
    const response = yield* Effect.promise(() =>
      serveFile({
        ...fileParams,
        file: markdownFile,
        extraHeaders: markdownPageHeaders(
          loaded.manifest.target.publicOrigin,
          markdownFile.path
        ),
      })
    );
    return Option.some(response);
  }
);
