import { SITE_CONFIG_FILENAME } from "@notra/sites-core/constants/sites";

import { STARTER_ROOT_MARKER_PREFIX } from "../constants/starter";
import { parseRootDirectory, repositoryPath } from "./root-directory";

export function starterRootMetadata(rootDirectory: string): string {
  return `${STARTER_ROOT_MARKER_PREFIX}${JSON.stringify(parseRootDirectory(rootDirectory))} -->`;
}

export function starterPullRequestMatchesRoot(
  body: string | null,
  rootDirectory: string
): boolean {
  if (!body) {
    return false;
  }
  const root = parseRootDirectory(rootDirectory);
  const markers = body
    .split(/\r?\n/)
    .filter((line) => line.startsWith(STARTER_ROOT_MARKER_PREFIX));
  if (markers.length) {
    return markers.length === 1 && markers[0] === starterRootMetadata(root);
  }
  const configLine = `- \`${repositoryPath(root, SITE_CONFIG_FILENAME)}\``;
  return body.split(/\r?\n/).some((line) => line === configLine);
}
