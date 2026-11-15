import { createHash } from "node:crypto";

import type {
  InMemoryCommit,
  MemoryCommitInfo,
  MemoryCommitInput,
  MemoryStore,
} from "../types/memory";
import { MemoryConflictError } from "../utils/errors";

/** Same semantics as code.storage, kept in a map. For tests and evals. */
export function createInMemoryStore(): MemoryStore & {
  commits(organizationId: string): readonly MemoryCommitInfo[];
} {
  const repos = new Map<string, InMemoryCommit[]>();
  const tip = (organizationId: string) => repos.get(organizationId)?.at(-1);
  const at = (organizationId: string, ref: string) =>
    repos.get(organizationId)?.find((commit) => commit.sha === ref) ??
    (ref === "main" ? tip(organizationId) : undefined);

  return {
    head: async (organizationId) => tip(organizationId)?.sha ?? null,
    read: async (organizationId, path, ref) =>
      at(organizationId, ref)?.files.get(path) ?? null,
    list: async (organizationId, ref) => [
      ...(at(organizationId, ref)?.files.keys() ?? []),
    ],
    commit: async (organizationId, input: MemoryCommitInput) => {
      const current = tip(organizationId);
      if ((current?.sha ?? null) !== input.expectedHeadSha) {
        throw new MemoryConflictError("The memory changed since it was read");
      }
      const files = new Map(current?.files);
      for (const [path, content] of Object.entries(input.files)) {
        if (content === null) {
          files.delete(path);
        } else {
          files.set(path, content);
        }
      }
      const commits = repos.get(organizationId) ?? [];
      const sha = createHash("sha1")
        .update(`${organizationId}:${commits.length}:${input.message}`)
        .digest("hex");
      commits.push({
        sha,
        message: input.message,
        authorName: input.author?.name ?? "Notra",
        date: new Date().toISOString(),
        files,
      });
      repos.set(organizationId, commits);
      return sha;
    },
    deleteRepo: async (organizationId, signal) => {
      signal?.throwIfAborted();
      repos.delete(organizationId);
    },
    commits: (organizationId) => repos.get(organizationId) ?? [],
  };
}
