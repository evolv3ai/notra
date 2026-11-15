import { GITHUB_API_VERSION_HEADERS } from "@notra/ai/constants/github";
import { githubApiUrl } from "@notra/ai/utils/github-api-url";
import { SITE_BUILD_LIMITS } from "@notra/sites-core/constants/sites";
import {
  SITE_IGNORE_FILENAME,
  SITE_IGNORE_MAX_BYTES,
} from "@notra/sites-core/constants/source";
import { createSiteIgnore } from "@notra/sites-core/utils/site-ignore";
import { isCollectedSiteSourcePath } from "@notra/sites-core/utils/source-files";
import { Effect } from "effect";

import {
  GITHUB_ARCHIVE_TIMEOUT_MS,
  GITHUB_SOURCE_DOWNLOAD_CONCURRENCY,
  GITHUB_SOURCE_DOWNLOAD_MAX_FILES,
  GITHUB_TREE_RESPONSE_MAX_BYTES,
  GITHUB_SOURCE_METADATA_MAX_BYTES,
  GITHUB_METADATA_ATTRIBUTE_LINE,
} from "./constants/github";
import { SiteProviderRequestError } from "./errors/provider";
import { SitePermanentBuildError } from "./errors/sites";
import { downloadRepositoryTarballEffect } from "./github";
import { githubSourceTreeSchema } from "./schemas/github-source";
import type { SiteRepository } from "./types/github";
import type { GithubSourceEntry } from "./types/github-source";
import { isGitLfsPointer } from "./utils/git-lfs";
import { readBodyUpToEffect } from "./utils/read-body";
import { isSafeRootDirectory } from "./utils/root-directory";
import { writeTarGz } from "./utils/write-tar-gz";

const githubSourceBytes = Effect.fn("Sites.GitHub.sourceBytes")(
  function* (
    repository: SiteRepository,
    token: string,
    path: string,
    accept: string,
    maxBytes: number
  ) {
    const controller = yield* Effect.acquireRelease(
      Effect.sync(() => new AbortController()),
      (owned) => Effect.sync(() => owned.abort())
    );
    const failure = (status: number | null) =>
      new SiteProviderRequestError({
        provider: "github",
        operation: "downloadSource",
        status,
        message: "Downloading the GitHub site source failed",
      });
    const response = yield* Effect.tryPromise({
      try: async (signal) => {
        const result = await fetch(
          `${githubApiUrl()}/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/git/${path}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: accept,
              ...GITHUB_API_VERSION_HEADERS,
            },
            signal: AbortSignal.any([controller.signal, signal]),
            redirect: "error",
          }
        );
        if (signal.aborted) {
          void result.body?.cancel().catch(() => undefined);
        }
        return result;
      },
      catch: () => failure(null),
    });
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        void response.body?.cancel().catch(() => undefined);
      })
    );
    if (!response.ok) {
      return yield* Effect.fail(failure(response.status));
    }
    if (Number(response.headers.get("content-length") ?? 0) > maxBytes) {
      return yield* Effect.fail(
        new SitePermanentBuildError(
          "The GitHub site source exceeds its size limit"
        )
      );
    }
    const body = yield* readBodyUpToEffect(response, maxBytes).pipe(
      Effect.mapError(() => failure(response.status))
    );
    if (body.exceeded) {
      return yield* Effect.fail(
        new SitePermanentBuildError(
          "The GitHub site source exceeds its size limit"
        )
      );
    }
    return body.bytes;
  },
  (program) => program.pipe(Effect.scoped)
);

const githubSourceTree = Effect.fn("Sites.GitHub.sourceTree")(function* (
  repository: SiteRepository,
  token: string,
  treeSha: string,
  recursive: boolean
) {
  const bytes = yield* githubSourceBytes(
    repository,
    token,
    `trees/${encodeURIComponent(treeSha)}${recursive ? "?recursive=1" : ""}`,
    "application/vnd.github+json",
    GITHUB_TREE_RESPONSE_MAX_BYTES
  );
  const tree = yield* Effect.try({
    try: () =>
      githubSourceTreeSchema.parse(JSON.parse(new TextDecoder().decode(bytes))),
    catch: () =>
      new SiteProviderRequestError({
        provider: "github",
        operation: "downloadSource",
        status: 200,
        message: "GitHub returned an invalid site source tree",
      }),
  });
  return tree;
});

const githubSourceFile = Effect.fn("Sites.GitHub.sourceFile")(function* (
  repository: SiteRepository,
  token: string,
  file: GithubSourceEntry,
  maxBytes: number
) {
  if (
    file.type !== "blob" ||
    !["100644", "100755"].includes(file.mode) ||
    file.size === undefined ||
    file.size > maxBytes
  ) {
    return yield* Effect.fail(
      new SitePermanentBuildError(
        `Site source "${file.path}" must be a regular file within its size limit`
      )
    );
  }
  const bytes = yield* githubSourceBytes(
    repository,
    token,
    `blobs/${file.sha}`,
    "application/vnd.github.raw+json",
    file.size
  );
  if (bytes.byteLength !== file.size) {
    return yield* Effect.fail(
      new SiteProviderRequestError({
        provider: "github",
        operation: "downloadSource",
        status: 200,
        message: "GitHub returned an incomplete site source file",
      })
    );
  }
  return bytes;
});

const githubSourceAttributesCompatible = Effect.fn(
  "Sites.GitHub.sourceAttributesCompatible"
)(function* (
  repository: SiteRepository,
  token: string,
  entries: GithubSourceEntry[]
) {
  for (const file of entries) {
    const name = file.path.split("/").at(-1);
    if (name === ".lfsconfig") {
      return false;
    }
    if (name !== ".gitattributes") {
      continue;
    }
    if (
      file.type !== "blob" ||
      !["100644", "100755"].includes(file.mode) ||
      file.size === undefined ||
      file.size > GITHUB_SOURCE_METADATA_MAX_BYTES
    ) {
      return false;
    }
    const bytes = yield* githubSourceFile(
      repository,
      token,
      file,
      GITHUB_SOURCE_METADATA_MAX_BYTES
    );
    if (
      new TextDecoder()
        .decode(bytes)
        .split("\n")
        .some((line) => {
          const trimmed = line.trim();
          return (
            trimmed &&
            !trimmed.startsWith("#") &&
            (trimmed.startsWith("[attr]") ||
              !GITHUB_METADATA_ATTRIBUTE_LINE.test(trimmed))
          );
        })
    ) {
      return false;
    }
  }
  return true;
});

export const downloadSiteSourceEffect = Effect.fn(
  "Sites.GitHub.downloadSiteSource"
)(
  function* (
    repository: SiteRepository,
    token: string,
    commitSha: string,
    rootDirectory: string
  ) {
    if (!isSafeRootDirectory(rootDirectory)) {
      return yield* Effect.fail(
        new SitePermanentBuildError("Invalid site root directory")
      );
    }
    if (!rootDirectory) {
      return yield* downloadRepositoryTarballEffect(
        repository,
        token,
        commitSha
      );
    }
    let treeSha = commitSha;
    for (const segment of rootDirectory.split("/")) {
      const tree = yield* githubSourceTree(repository, token, treeSha, false);
      if (tree.truncated) {
        return yield* downloadRepositoryTarballEffect(
          repository,
          token,
          commitSha
        );
      }
      const entries = tree.tree;
      const directory = entries.find(
        (entry) =>
          entry.path === segment &&
          entry.type === "tree" &&
          entry.mode === "040000"
      );
      if (!directory) {
        return yield* Effect.fail(
          new SitePermanentBuildError(
            `Site directory "${rootDirectory}" does not exist at this commit`
          )
        );
      }
      if (
        !(yield* githubSourceAttributesCompatible(repository, token, entries))
      ) {
        return yield* downloadRepositoryTarballEffect(
          repository,
          token,
          commitSha
        );
      }
      treeSha = directory.sha;
    }
    const tree = yield* githubSourceTree(repository, token, treeSha, true);
    if (tree.truncated) {
      return yield* downloadRepositoryTarballEffect(
        repository,
        token,
        commitSha
      );
    }
    const entries = tree.tree;
    const paths = new Set<string>();
    for (const file of entries) {
      if (
        file.path.includes("\0") ||
        file.path
          .split("/")
          .some((segment) => !segment || segment === "." || segment === "..") ||
        paths.has(file.path)
      ) {
        return yield* Effect.fail(
          new SitePermanentBuildError(
            "The GitHub site source contains an unsafe or duplicate path"
          )
        );
      }
      paths.add(file.path);
    }
    if (
      !(yield* githubSourceAttributesCompatible(repository, token, entries))
    ) {
      return yield* downloadRepositoryTarballEffect(
        repository,
        token,
        commitSha
      );
    }
    const ignoreFile = entries.find(
      (file) => file.path === SITE_IGNORE_FILENAME
    );
    const ignoreBytes = ignoreFile
      ? yield* githubSourceFile(
          repository,
          token,
          ignoreFile,
          SITE_IGNORE_MAX_BYTES
        )
      : null;
    if (ignoreBytes && isGitLfsPointer(ignoreBytes)) {
      return yield* downloadRepositoryTarballEffect(
        repository,
        token,
        commitSha
      );
    }
    const isIgnored = yield* Effect.try({
      try: () =>
        createSiteIgnore(
          ignoreBytes ? new TextDecoder().decode(ignoreBytes) : ""
        ),
      catch: () =>
        new SitePermanentBuildError(
          `The ${SITE_IGNORE_FILENAME} file is invalid`
        ),
    });
    const files = entries.filter(
      (file) =>
        file.type === "blob" &&
        file.mode !== "120000" &&
        isCollectedSiteSourcePath(file.path) &&
        !isIgnored(file.path)
    );
    let totalBytes = 0;
    for (const file of files) {
      if (
        file.type !== "blob" ||
        !["100644", "100755"].includes(file.mode) ||
        file.size === undefined
      ) {
        return yield* Effect.fail(
          new SitePermanentBuildError(
            `Site source "${file.path}" is not a regular file`
          )
        );
      }
      if (file.size > SITE_BUILD_LIMITS.maxSingleFileBytes) {
        return yield* Effect.fail(
          new SitePermanentBuildError(
            `Site source "${file.path}" exceeds the per-file size limit`
          )
        );
      }
      totalBytes += file.size;
    }
    if (
      files.length > SITE_BUILD_LIMITS.maxSourceFiles ||
      totalBytes > SITE_BUILD_LIMITS.maxSourceBytes
    ) {
      return yield* Effect.fail(
        new SitePermanentBuildError(
          "The site source exceeds the size or file count limit"
        )
      );
    }
    if (files.length > GITHUB_SOURCE_DOWNLOAD_MAX_FILES) {
      return yield* downloadRepositoryTarballEffect(
        repository,
        token,
        commitSha
      );
    }
    const source = yield* Effect.forEach(
      files,
      (file) =>
        Effect.gen(function* () {
          const bytes = yield* githubSourceFile(
            repository,
            token,
            file,
            SITE_BUILD_LIMITS.maxSingleFileBytes
          );
          return { path: `source/${rootDirectory}/${file.path}`, data: bytes };
        }),
      { concurrency: GITHUB_SOURCE_DOWNLOAD_CONCURRENCY }
    );
    if (source.some((file) => isGitLfsPointer(file.data))) {
      return yield* downloadRepositoryTarballEffect(
        repository,
        token,
        commitSha
      );
    }
    if (ignoreBytes) {
      source.push({
        path: `source/${rootDirectory}/${SITE_IGNORE_FILENAME}`,
        data: ignoreBytes,
      });
    }
    return yield* Effect.tryPromise({
      try: () => writeTarGz(source, `source/${rootDirectory}/`),
      catch: () =>
        new SitePermanentBuildError("Packing the site source failed"),
    });
  },
  (program) =>
    program.pipe(
      Effect.timeoutOrElse({
        duration: GITHUB_ARCHIVE_TIMEOUT_MS,
        orElse: () =>
          Effect.fail(
            new SiteProviderRequestError({
              provider: "github",
              operation: "downloadSource",
              status: null,
              message: "Downloading the GitHub site source timed out",
            })
          ),
      })
    )
);
