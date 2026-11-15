import { createHash } from "node:crypto";

import { ApiError, GitStorage, RefUpdateError } from "@pierre/storage";
import type { Repo } from "@pierre/storage";

import {
  MEMORY_AUTHOR,
  MEMORY_BRANCH,
  MEMORY_REPO_HASH_LENGTH,
  MEMORY_REPO_NOT_FOUND,
  MEMORY_REPO_PREFIX,
  MEMORY_REPO_UNSAFE_CHARS,
  MEMORY_SEED,
} from "../constants/memory";
import type { MemoryStore } from "../types/memory";
import { MemoryConflictError } from "../utils/errors";

/** Ids with unsafe characters get a hash suffix, so "org.a" and "org_a" never share a repo. */
export function memoryRepoId(organizationId: string) {
  const safe = organizationId.replace(MEMORY_REPO_UNSAFE_CHARS, "_");
  if (safe === organizationId) {
    return `${MEMORY_REPO_PREFIX}${safe}`;
  }
  const hash = createHash("sha256").update(organizationId).digest("hex");
  return `${MEMORY_REPO_PREFIX}${safe}-${hash.slice(0, MEMORY_REPO_HASH_LENGTH)}`;
}

/** The SDK reports a missing repository as a plain Error on some calls. */
function isNotFound(error: unknown) {
  return (
    (error instanceof ApiError && error.status === 404) ||
    (error instanceof Error && MEMORY_REPO_NOT_FOUND.test(error.message))
  );
}

export function createCodeStorageStore(options: {
  name: string;
  key: string;
}): MemoryStore {
  const storage = new GitStorage({ name: options.name, key: options.key });
  const handles = new Map<string, Repo>();

  async function findRepo(organizationId: string) {
    const cached = handles.get(organizationId);
    if (cached) {
      return cached;
    }
    const repo = await storage.findOne({ id: memoryRepoId(organizationId) });
    if (repo) {
      handles.set(organizationId, repo);
    }
    return repo;
  }

  /**
   * Runs `use` with the workspace's repo. Another instance may have deleted
   * or recreated it since the handle was cached, so a missing repo drops the
   * handle and looks it up once more.
   */
  async function withRepo<RESULT>(
    organizationId: string,
    use: (repo: Repo) => Promise<RESULT>,
    missing: () => RESULT | Promise<RESULT>
  ): Promise<RESULT> {
    const cached = handles.has(organizationId);
    const repo = await findRepo(organizationId);
    if (!repo) {
      return missing();
    }
    try {
      return await use(repo);
    } catch (error) {
      if (!(cached && isNotFound(error))) {
        throw error;
      }
      handles.delete(organizationId);
      const fresh = await findRepo(organizationId);
      return fresh ? use(fresh) : missing();
    }
  }

  async function branchHead(repo: Repo) {
    const { branches } = await repo.listBranches({ limit: 100 });
    return (
      branches.find((branch) => branch.name === MEMORY_BRANCH)?.headSha ?? null
    );
  }

  /**
   * code.storage cannot guard a commit on "the branch does not exist yet", so
   * a new repo starts with one commit and every write can name its parent.
   */
  async function createSeededRepo(organizationId: string) {
    try {
      const repo = await storage.createRepo({
        id: memoryRepoId(organizationId),
        defaultBranch: MEMORY_BRANCH,
      });
      handles.set(organizationId, repo);
      const seed = await repo
        .createCommit({
          targetBranch: MEMORY_BRANCH,
          commitMessage: MEMORY_SEED.message,
          author: MEMORY_AUTHOR,
          committer: MEMORY_AUTHOR,
        })
        .addFileFromString(MEMORY_SEED.path, MEMORY_SEED.content)
        .send();
      return { repo, head: seed.commitSha };
    } catch (error) {
      if (await findRepo(organizationId)) {
        throw new MemoryConflictError("Another writer created the memory");
      }
      throw error;
    }
  }

  /** The repo to write to and the head the commit must build on. */
  async function writeTarget(organizationId: string, expected: string | null) {
    const repo = await findRepo(organizationId);
    if (!repo) {
      if (expected) {
        throw new MemoryConflictError(
          "The memory was deleted since it was read"
        );
      }
      return createSeededRepo(organizationId);
    }
    if (expected) {
      return { repo, head: expected };
    }
    // The writer read an empty memory: only an unwritten repo still is.
    const head = await branchHead(repo);
    if (head) {
      throw new MemoryConflictError("The memory changed since it was read");
    }
    return { repo, head };
  }

  return {
    head: (organizationId) => withRepo(organizationId, branchHead, () => null),
    read: (organizationId, path, ref) =>
      withRepo(
        organizationId,
        async (repo) => {
          const response = await repo.getFileStream({ path, ref });
          if (response.ok) {
            return await response.text();
          }
          // Only a confirmed missing file reads as empty: treating any other
          // failure as empty would let the next write drop the file's records.
          if (response.status === 404) {
            return null;
          }
          throw new Error(
            `code.storage read of ${path} failed with status ${response.status}`
          );
        },
        () => null
      ).catch((error: unknown) => {
        if (isNotFound(error)) {
          return null;
        }
        throw error;
      }),
    list: (organizationId, ref) =>
      withRepo(
        organizationId,
        async (repo) => (await repo.listFiles({ ref })).paths,
        () => []
      ),
    async commit(organizationId, input) {
      const { repo, head } = await writeTarget(
        organizationId,
        input.expectedHeadSha
      );
      let builder = repo.createCommit({
        targetBranch: MEMORY_BRANCH,
        commitMessage: input.message,
        author: input.author ?? MEMORY_AUTHOR,
        committer: MEMORY_AUTHOR,
        ...(head ? { expectedHeadSha: head } : {}),
      });
      for (const [path, content] of Object.entries(input.files)) {
        builder =
          content === null
            ? builder.deletePath(path)
            : builder.addFileFromString(path, content);
      }
      try {
        return (await builder.send()).commitSha;
      } catch (error) {
        if (error instanceof RefUpdateError) {
          throw new MemoryConflictError(error.message);
        }
        if (isNotFound(error)) {
          handles.delete(organizationId);
          throw new MemoryConflictError(
            "The memory was deleted since it was read"
          );
        }
        throw error;
      }
    },
    async deleteRepo(organizationId, signal) {
      signal?.throwIfAborted();
      handles.delete(organizationId);
      const deleted = storage
        .deleteRepo({ id: memoryRepoId(organizationId) })
        .then(
          () => undefined,
          (error: unknown) => {
            if (!isNotFound(error)) {
              throw error;
            }
          }
        );
      if (!signal) {
        return deleted;
      }
      // The SDK takes no signal, so the deadline is enforced around it. One
      // signal can cover many deletions, so each removes its own listener.
      let onAbort: (() => void) | undefined;
      try {
        await Promise.race([
          deleted,
          new Promise<never>((_resolve, reject) => {
            onAbort = () => reject(signal.reason);
            signal.addEventListener("abort", onAbort, { once: true });
          }),
        ]);
      } finally {
        if (onAbort) {
          signal.removeEventListener("abort", onAbort);
        }
      }
    },
  };
}
