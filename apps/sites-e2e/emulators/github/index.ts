import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { createEmulator } from "emulate";

import { serveFetch } from "../core/http-server";
import { EmulatorError, startEmulator } from "../core/service";
import type { RouteParams } from "../core/types";
import type {
  CommitOnBranchInput,
  EmulatedFileChange,
  EmulatedPull,
  GitHubEmulatorOptions,
  GraphQLVariables,
} from "./types";

const OWNER_TOKEN = "e2e_repository_owner";
const CODELOAD_PATH = "/_codeload";

// A stateful GitHub for the connected lifecycle: vercel-labs/emulate serves
// the REST API, GitHub App JWT/installation tokens, check runs, comments and
// signed webhooks. This proxy adds the three routes emulate lacks and the
// pipeline needs (tarball download, GraphQL createCommitOnBranch, branch
// rules) and fills in response fields GitHub returns but emulate omits, built
// on emulate's own API so every write stays in its state and fires its
// webhooks.
export async function startGitHubEmulator(options: GitHubEmulatorOptions) {
  const { owner, repo } = options;
  const cleanup: (() => Promise<void>)[] = [];
  try {
    const webhookRelay = await serveFetch(async (request) => {
      let body = Buffer.from(await request.arrayBuffer());
      const headers = new Headers(request.headers);
      headers.delete("host");
      headers.delete("content-length");
      const payload = JSON.parse(body.toString("utf8")) as {
        after?: string;
        deleted?: boolean;
        head_commit?: unknown;
      };
      if (
        headers.get("x-github-event") === "push" &&
        payload.head_commit === undefined &&
        !payload.deleted &&
        payload.after
      ) {
        const commit = await api<{
          sha: string;
          commit: { message: string; author: { name: string } };
        }>("GET", `${repoPath}/commits/${payload.after}`);
        body = Buffer.from(
          JSON.stringify({
            ...payload,
            head_commit: {
              id: commit.sha,
              message: commit.commit.message,
              author: { name: commit.commit.author.name },
            },
          })
        );
        headers.set(
          "x-hub-signature-256",
          `sha256=${createHmac("sha256", options.webhookSecret).update(body).digest("hex")}`
        );
      }
      const response = await fetch(options.webhookUrl, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(10_000),
      });
      return new Response(await response.arrayBuffer(), {
        status: response.status,
      });
    });
    cleanup.push(() => webhookRelay.stop());
    const emulator = await createEmulator({
      service: "github",
      port: 0,
      seed: {
        tokens: { [OWNER_TOKEN]: { login: owner, scopes: ["repo"] } },
        github: {
          users: [{ login: owner }],
          repos: [{ owner, name: repo, auto_init: true }],
          apps: [
            {
              app_id: options.appId,
              slug: "notra-sites-e2e",
              name: "Notra Sites E2E",
              permissions: {
                contents: "write",
                checks: "write",
                pull_requests: "write",
                metadata: "read",
              },
              events: ["push", "pull_request", "check_run"],
              webhook_url: `http://127.0.0.1:${webhookRelay.port}`,
              webhook_secret: options.webhookSecret,
              installations: [
                {
                  installation_id: options.installationId,
                  account: owner,
                  repository_selection: "all",
                },
              ],
            },
          ],
        },
      },
    });
    cleanup.push(() => emulator.close());
    const privateKey = emulator.generatedSecrets.find(
      (secret) => secret.kind === "github.app_private_key"
    )?.value;
    if (!privateKey) {
      throw new Error("emulate did not generate a GitHub App key");
    }

    const api = async <T>(
      method: string,
      path: string,
      body?: unknown,
      authorization = `Bearer ${OWNER_TOKEN}`
    ): Promise<T> => {
      const response = await fetch(`${emulator.url}${path}`, {
        method,
        headers: {
          authorization,
          accept: "application/vnd.github+json",
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!response.ok) {
        throw new EmulatorError(
          response.status,
          `emulate ${method} ${path}: ${response.status} ${await response.text()}`
        );
      }
      return (await response.json()) as T;
    };
    const repoPath = `/repos/${owner}/${repo}`;
    const headOf = async (branch: string, authorization?: string) =>
      (
        await api<{ object: { sha: string } }>(
          "GET",
          `${repoPath}/git/ref/heads/${branch}`,
          undefined,
          authorization
        )
      ).object.sha;

    const commitOnBranch = async (input: {
      branch: string;
      message: string;
      changes: EmulatedFileChange[];
      expectedHeadOid?: string;
      replaceTree?: boolean;
      authorization?: string;
    }) => {
      const { authorization } = input;
      const head = await headOf(input.branch, authorization);
      if (input.expectedHeadOid && input.expectedHeadOid !== head) {
        throw new EmulatorError(
          409,
          `Expected branch to point to "${input.expectedHeadOid}" but it did not`
        );
      }
      const parent = await api<{ tree: { sha: string } }>(
        "GET",
        `${repoPath}/git/commits/${head}`,
        undefined,
        authorization
      );
      const tree = [];
      for (const change of input.changes) {
        if (change.content === null) {
          tree.push({
            path: change.path,
            mode: "100644",
            type: "blob",
            sha: null,
          });
          continue;
        }
        const blob = await api<{ sha: string }>(
          "POST",
          `${repoPath}/git/blobs`,
          {
            content: Buffer.from(change.content).toString("base64"),
            encoding: "base64",
          },
          authorization
        );
        tree.push({
          path: change.path,
          mode: "100644",
          type: "blob",
          sha: blob.sha,
        });
      }
      const created = await api<{ sha: string }>(
        "POST",
        `${repoPath}/git/trees`,
        {
          ...(input.replaceTree ? {} : { base_tree: parent.tree.sha }),
          tree,
        },
        authorization
      );
      const commit = await api<{ sha: string }>(
        "POST",
        `${repoPath}/git/commits`,
        { message: input.message, tree: created.sha, parents: [head] },
        authorization
      );
      await api(
        "PATCH",
        `${repoPath}/git/refs/heads/${input.branch}`,
        { sha: commit.sha },
        authorization
      );
      return commit.sha;
    };

    const codeloadTokens = new Map<
      string,
      { sha: string; authorization: string }
    >();
    const tarball = async (ref: string, authorization: string) => {
      const commit = await api<{
        sha: string;
        commit: { tree: { sha: string } };
      }>("GET", `${repoPath}/commits/${ref}`, undefined, authorization);
      const tree = await api<{
        tree: { path: string; type: string; sha: string }[];
      }>(
        "GET",
        `${repoPath}/git/trees/${commit.commit.tree.sha}?recursive=1`,
        undefined,
        authorization
      );
      const work = await mkdtemp(join(options.directory, "tarball-"));
      const top = `${owner}-${repo}-${commit.sha.slice(0, 7)}`;
      try {
        for (const entry of tree.tree) {
          if (entry.type !== "blob") {
            continue;
          }
          const blob = await api<{ content: string }>(
            "GET",
            `${repoPath}/git/blobs/${entry.sha}`,
            undefined,
            authorization
          );
          const path = join(work, top, entry.path);
          await mkdir(dirname(path), { recursive: true });
          await writeFile(path, Buffer.from(blob.content, "base64"));
        }
        return new Uint8Array(
          execFileSync(
            "tar",
            ["--format=ustar", "-czf", "-", "-C", work, top],
            {
              maxBuffer: 256 * 1024 * 1024,
            }
          )
        );
      } finally {
        await rm(work, { recursive: true, force: true });
      }
    };

    const guarded =
      (
        handle: (
          request: Request,
          params: RouteParams,
          authorization: string
        ) => Promise<Response>
      ) =>
      async (request: Request, params: RouteParams) => {
        try {
          return await handle(
            request,
            params,
            request.headers.get("authorization") ?? ""
          );
        } catch (error) {
          const status = error instanceof EmulatorError ? error.status : 500;
          return Response.json({ message: String(error) }, { status });
        }
      };
    // Everything else goes to emulate unchanged.
    const forward = async (request: Request) => {
      const url = new URL(request.url);
      const upstream = await fetch(
        `${emulator.url}${url.pathname}${url.search}`,
        {
          method: request.method,
          headers: request.headers,
          body: ["GET", "HEAD"].includes(request.method)
            ? undefined
            : await request.arrayBuffer(),
          redirect: "manual",
        }
      );
      const headers = new Headers(upstream.headers);
      headers.delete("content-encoding");
      headers.delete("content-length");
      return new Response(upstream.body, { status: upstream.status, headers });
    };
    const graphQLError = (message: string) =>
      Response.json({ data: null, errors: [{ message }] });
    const createCommitOnBranchGraphQL = async (
      input: CommitOnBranchInput | undefined,
      authorization: string
    ) => {
      if (input?.branch.repositoryNameWithOwner !== `${owner}/${repo}`) {
        return Response.json(
          { errors: [{ message: "Unsupported GraphQL operation" }] },
          { status: 400 }
        );
      }
      try {
        const oid = await commitOnBranch({
          branch: input.branch.branchName,
          message: input.message.headline,
          expectedHeadOid: input.expectedHeadOid,
          authorization,
          changes: [
            ...(input.fileChanges.additions ?? []).map((file) => ({
              path: file.path,
              content: Buffer.from(file.contents, "base64"),
            })),
            ...(input.fileChanges.deletions ?? []).map((file) => ({
              path: file.path,
              content: null,
            })),
          ],
        });
        return Response.json({
          data: { createCommitOnBranch: { commit: { oid } } },
        });
      } catch (error) {
        return graphQLError(String((error as Error).message));
      }
    };
    const pullByNodeId = async (id: string, authorization: string) =>
      (
        await api<EmulatedPull[]>(
          "GET",
          `${repoPath}/pulls?state=all&per_page=100`,
          undefined,
          authorization
        )
      ).find((pull) => pull.node_id === id) ?? null;
    // GitHub's GraphQL view of a pull request, derived from emulate's REST one.
    const pullRequestNode = (pull: EmulatedPull) => {
      let state = "OPEN";
      if (pull.merged) {
        state = "MERGED";
      } else if (pull.state === "closed") {
        state = "CLOSED";
      }
      let mergeStateStatus = "UNKNOWN";
      if (pull.draft) {
        mergeStateStatus = "DRAFT";
      } else if (pull.mergeable_state === "clean") {
        mergeStateStatus = "CLEAN";
      }
      let mergeable = "UNKNOWN";
      if (pull.mergeable === true) {
        mergeable = "MERGEABLE";
      } else if (pull.mergeable === false) {
        mergeable = "CONFLICTING";
      }
      return {
        id: pull.node_id,
        number: pull.number,
        url: pull.html_url,
        isDraft: pull.draft,
        state,
        merged: pull.merged,
        mergeable,
        mergeStateStatus,
        reviewDecision: null,
        headRefOid: pull.head.sha,
        commits: { totalCount: pull.commits ?? 0 },
      };
    };
    const deliverAppWebhook = async (event: string, payload: object) => {
      const body = JSON.stringify({
        ...payload,
        installation: {
          id: options.installationId,
          node_id: Buffer.from(`0:Installation${options.installationId}`)
            .toString("base64")
            .replace(/=+$/, ""),
        },
      });
      await fetch(options.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-GitHub-Event": event,
          "X-GitHub-Delivery": randomUUID(),
          "X-Hub-Signature-256": `sha256=${createHmac("sha256", options.webhookSecret).update(body).digest("hex")}`,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
    };
    const proxy = await startEmulator(
      "github",
      [
        {
          method: "GET",
          path: `${repoPath}/tarball/:ref+`,
          handle: guarded(async (request, params, authorization) => {
            const commit = await api<{ sha: string }>(
              "GET",
              `${repoPath}/commits/${params.ref ?? ""}`,
              undefined,
              authorization
            );
            const token = randomUUID();
            codeloadTokens.set(token, { sha: commit.sha, authorization });
            const location = new URL(
              `${CODELOAD_PATH}/${owner}/${repo}/legacy.tar.gz/${commit.sha}?token=${token}`,
              request.url
            );
            return new Response(null, {
              status: 302,
              headers: { location: location.href },
            });
          }),
        },
        {
          method: "GET",
          path: `${CODELOAD_PATH}/${owner}/${repo}/legacy.tar.gz/:sha`,
          handle: guarded(async (request, params) => {
            const token = new URL(request.url).searchParams.get("token") ?? "";
            const grant = codeloadTokens.get(token);
            codeloadTokens.delete(token);
            if (!grant || grant.sha !== params.sha) {
              throw new EmulatorError(404, "Unknown or used codeload token");
            }
            return new Response(await tarball(grant.sha, grant.authorization), {
              headers: { "content-type": "application/x-gzip" },
            });
          }),
        },
        {
          method: "POST",
          path: "/graphql",
          handle: guarded(async (request, _params, authorization) => {
            const { query, variables } = (await request.json()) as {
              query: string;
              variables?: GraphQLVariables;
            };
            if (query.includes("createCommitOnBranch")) {
              return await createCommitOnBranchGraphQL(
                variables?.input as CommitOnBranchInput | undefined,
                authorization
              );
            }
            // The site editor reads a branch's pull request by node ID and
            // marks it ready for review; emulate keeps the REST state.
            if (query.includes("markPullRequestReadyForReview")) {
              const pull = await pullByNodeId(
                String(
                  (variables?.input as { pullRequestId?: string } | undefined)
                    ?.pullRequestId ?? variables?.id
                ),
                authorization
              );
              if (!pull) {
                return graphQLError("Could not resolve to a PullRequest");
              }
              await api(
                "PATCH",
                `${repoPath}/pulls/${pull.number}`,
                { draft: false },
                authorization
              );
              return Response.json({
                data: {
                  markPullRequestReadyForReview: {
                    pullRequest: { id: pull.node_id },
                  },
                },
              });
            }
            if (query.includes("node(id:")) {
              const pull = await pullByNodeId(
                String(variables?.id),
                authorization
              );
              return Response.json({
                data: { node: pull ? pullRequestNode(pull) : null },
              });
            }
            // Classic branch protection: the fixture repository has none.
            if (query.includes("branchProtectionRule")) {
              return Response.json({
                data: {
                  repository: { ref: { branchProtectionRule: null } },
                },
              });
            }
            return Response.json(
              { errors: [{ message: "Unsupported GraphQL operation" }] },
              { status: 400 }
            );
          }),
        },
        {
          // GitHub sends a push for the base branch when it merges a pull
          // request; emulate only sends pull_request.closed, so deliver the
          // push the way emulate signs its own app webhooks.
          method: "PUT",
          path: `${repoPath}/pulls/:number/merge`,
          handle: guarded(async (request, params, authorization) => {
            const pull = await api<EmulatedPull>(
              "GET",
              `${repoPath}/pulls/${params.number}`,
              undefined,
              authorization
            );
            const before = await headOf(pull.base.ref, authorization);
            const response = await forward(request);
            if (!response.ok) {
              return response;
            }
            const result = (await response.json()) as { sha: string };
            const commit = await api<{
              commit: { message: string; author: { name: string } };
            }>(
              "GET",
              `${repoPath}/commits/${result.sha}`,
              undefined,
              authorization
            );
            await deliverAppWebhook("push", {
              ref: `refs/heads/${pull.base.ref}`,
              before,
              after: result.sha,
              created: false,
              deleted: false,
              forced: false,
              head_commit: {
                id: result.sha,
                message: commit.commit.message,
                author: { name: commit.commit.author.name },
              },
              repository: await api("GET", repoPath, undefined, authorization),
              sender: { login: owner },
            });
            return Response.json(result);
          }),
        },
        {
          method: "GET",
          path: `${repoPath}/rules/branches/:branch+`,
          handle: () => Response.json(options.branchRules ?? []),
        },
        {
          // GitHub's single-branch response embeds the full commit object;
          // emulate returns only { sha, url }.
          method: "GET",
          path: `${repoPath}/branches/:branch+`,
          handle: guarded(async (_request, params, authorization) => {
            const data = await api<{ commit: { sha: string } }>(
              "GET",
              `${repoPath}/branches/${encodeURIComponent(params.branch ?? "")}`,
              undefined,
              authorization
            );
            return Response.json({
              ...data,
              commit: await api(
                "GET",
                `${repoPath}/commits/${data.commit.sha}`,
                undefined,
                authorization
              ),
            });
          }),
        },
      ],
      { fallback: forward }
    );

    cleanup.push(() => proxy.close());
    const repository = await api<{ id: number }>("GET", repoPath);
    await commitOnBranch({
      branch: "main",
      message: "Initial site",
      replaceTree: true,
      changes: [...options.files].map(([path, content]) => ({ path, content })),
    });
    return {
      name: proxy.name,
      url: proxy.url,
      requests: proxy.requests,
      env: {
        GITHUB_API_URL: proxy.url,
        GITHUB_APP_ID: String(options.appId),
        GITHUB_APP_PRIVATE_KEY: privateKey,
        GITHUB_APP_SLUG: "notra-sites-e2e",
        GITHUB_APP_WEBHOOK_SECRET: options.webhookSecret,
      },
      appId: options.appId,
      privateKey,
      repositoryId: repository.id,
      head: (branch = "main") => headOf(branch),
      push: (changes: EmulatedFileChange[], message: string, branch = "main") =>
        commitOnBranch({ branch, message, changes }),
      createBranch: async (branch: string, from = "main") =>
        api("POST", `${repoPath}/git/refs`, {
          ref: `refs/heads/${branch}`,
          sha: await headOf(from),
        }),
      checkRuns: async (ref: string) =>
        (
          await api<{
            check_runs: {
              name: string;
              status: string;
              conclusion: string | null;
            }[];
          }>("GET", `${repoPath}/commits/${ref}/check-runs`)
        ).check_runs,
      pullRequests: () =>
        api<
          {
            number: number;
            title: string;
            state: "open" | "closed";
            draft: boolean;
            merged: boolean;
            head: { ref: string; sha: string };
            base: { ref: string };
          }[]
        >("GET", `${repoPath}/pulls?state=all`),
      file: async (path: string, ref = "main") => {
        try {
          const file = await api<{ content: string }>(
            "GET",
            `${repoPath}/contents/${path}?ref=${encodeURIComponent(ref)}`
          );
          return Buffer.from(file.content, "base64").toString("utf8");
        } catch (error) {
          if (error instanceof EmulatorError && error.status === 404) {
            return null;
          }
          throw error;
        }
      },
      close: async () => {
        await proxy.close();
        await emulator.close();
        await webhookRelay.stop();
      },
    };
  } catch (error) {
    await Promise.allSettled(
      cleanup.toReversed().map(async (close) => close())
    );
    throw error;
  }
}
