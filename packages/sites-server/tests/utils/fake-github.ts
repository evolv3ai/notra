import { createHash } from "node:crypto";
import { createServer } from "node:http";

import type {
  FakeGitHubCommitMetadata,
  FakeGitHubState,
  FakePullRequest,
} from "../types/fake-github";

export async function startFakeGitHub(port = 0, repositoryName = "blog") {
  const commitMetadata = new Map<string, FakeGitHubCommitMetadata>();
  const state: FakeGitHubState = {
    comments: [],
    commitDelayMs: 0,
    commitMetadataError: false,
    beforeCommitMetadata: async () => {},
    loseRenameResponse: false,
    loseRenameResponseAfter: null,
    hideClassicProtection: false,
    treeDelayMs: 0,
    protectionRules: null,
    protectionError: false,
    rulesetsUnavailable: false,
    omitProtected: false,
    rejectedMergeMethods: [],
    prErrorMessage: "",
    beforeTree: async () => {},
    branches: new Map([["main", "initial"]]),
    commits: new Map([
      [
        "initial",
        new Map([
          ["blog.json", '{"name":"Synthetic blog"}'],
          [
            "blog/hello.md",
            "---\ntitle: Hello\ndate: 2026-10-19\ndescription: Synthetic\n---\nHello world.",
          ],
        ]),
      ],
    ]),
    prs: [],
    classicPR: false,
    rulesPR: false,
    otherProtection: false,
    protectedFeatures: false,
    rejectDraft: false,
    failPR: false,
    staleCommit: false,
    commitCount: 0,
    calls: [],
    mergeMethod: null,
    beforeRead: async () => {},
    beforeCommit: async () => {},
  };
  const json = (body: unknown, status = 200) => Response.json(body, { status });
  const blob = (content: string) =>
    createHash("sha1")
      .update(`blob ${Buffer.byteLength(content)}\0`)
      .update(content)
      .digest("hex");
  const push = (branch: string, path: string, content: string) => {
    const previous = state.branches.get(branch);
    const files = new Map(state.commits.get(previous ?? ""));
    files.set(path, content);
    const sha = `commit-${++state.commitCount}`;
    state.commits.set(sha, files);
    commitMetadata.set(sha, {
      message: "Synthetic commit\nDetails",
      parentSha: previous ?? "initial",
    });
    state.branches.set(branch, sha);
    return sha;
  };
  const handle = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const path = decodeURIComponent(url.pathname);
    state.calls.push(`${request.method} ${path}`);
    const body =
      request.method === "GET" || request.method === "DELETE"
        ? {}
        : await request.json();
    if (path === "/__state") {
      if (request.method === "POST") {
        Object.assign(state, body);
      }
      return json({
        ...state,
        branches: Object.fromEntries(state.branches),
        commits: Object.fromEntries(
          [...state.commits].map(([sha, files]) => [
            sha,
            Object.fromEntries(files),
          ])
        ),
        beforeCommit: undefined,
      });
    }
    if (path === "/__push") {
      return json({ sha: push(body.branch, body.path, body.content) });
    }
    if (path === "/graphql") {
      const { query, variables } = body;
      if (query.includes("SiteBranchProtection")) {
        return json({
          data: {
            repository: {
              ref: {
                branchProtectionRule:
                  !state.hideClassicProtection &&
                  (state.classicPR ||
                    (state.protectedFeatures &&
                      variables.ref !== "refs/heads/main"))
                    ? { id: "classic-protection" }
                    : null,
              },
            },
          },
        });
      }
      if (query.includes("SiteBranchPullRequest")) {
        const pr = state.prs.find((entry) => entry.id === variables.id);
        return json({
          data: {
            node: pr
              ? {
                  id: pr.id,
                  number: pr.number,
                  url: pr.html_url,
                  isDraft: pr.draft,
                  state: pr.merged_at ? "MERGED" : pr.state.toUpperCase(),
                  merged: Boolean(pr.merged_at),
                  base: { ...pr.base, repo: { id: 500 } },
                  mergeable: pr.mergeable,
                  mergeStateStatus: pr.mergeStateStatus,
                  reviewDecision: pr.reviewDecision,
                  headRefOid: state.branches.get(pr.head.ref),
                }
              : null,
          },
        });
      }
      if (
        query.includes("SiteRequestReview") ||
        query.includes("MarkReadyForReview")
      ) {
        const pr = state.prs.find(
          (entry) => entry.id === (variables.id ?? variables.pullRequestId)
        );
        if (!pr) {
          return json({ errors: [{ message: "Missing pull request" }] });
        }
        pr.draft = false;
        return json({
          data: {
            markPullRequestReadyForReview: { pullRequest: { id: pr.id } },
          },
        });
      }
      const input = variables.input;
      if (query.includes("createCommitOnBranch")) {
        await state.beforeCommit();
        if (state.commitDelayMs) {
          await new Promise((resolve) =>
            setTimeout(resolve, state.commitDelayMs)
          );
        }
        const branch = input.branch.branchName;
        if (
          state.staleCommit ||
          state.branches.get(branch) !== input.expectedHeadOid
        ) {
          return json({
            errors: [
              {
                message: "Expected branch to point to old oid but it did not",
              },
            ],
          });
        }
        const files = new Map(state.commits.get(input.expectedHeadOid));
        for (const file of input.fileChanges.additions ?? []) {
          files.set(file.path, Buffer.from(file.contents, "base64").toString());
        }
        for (const file of input.fileChanges.deletions ?? []) {
          files.delete(file.path);
        }
        const sha = `commit-${++state.commitCount}`;
        state.commits.set(sha, files);
        commitMetadata.set(sha, {
          message: `${input.message.headline}\n${input.message.body ?? ""}`,
          parentSha: input.expectedHeadOid,
        });
        state.branches.set(branch, sha);
        return json({
          data: { createCommitOnBranch: { commit: { oid: sha } } },
        });
      }
      return json({ errors: [{ message: "Unexpected GraphQL query" }] });
    }
    const repo = `/repos/synthetic/${repositoryName}`;
    if (path === repo) {
      return json({
        full_name: `synthetic/${repositoryName}`,
        default_branch: "main",
        allow_squash_merge: true,
        allow_merge_commit: true,
        allow_rebase_merge: true,
      });
    }
    if (path === "/user") {
      return json({ login: "notra[bot]" });
    }
    if (path.startsWith(`${repo}/git/ref/heads/`)) {
      const branch = path.slice(`${repo}/git/ref/heads/`.length);
      const sha = state.branches.get(branch);
      return sha
        ? json({ ref: `refs/heads/${branch}`, object: { sha } })
        : json({ message: "Not found" }, 404);
    }
    if (path.startsWith(`${repo}/compare/`)) {
      const [base, head] = path.slice(`${repo}/compare/`.length).split("...");
      const baseSha = state.branches.get(base ?? "") ?? base ?? "";
      const headSha = state.branches.get(head ?? "") ?? head ?? "";
      const before = state.commits.get(baseSha) ?? new Map<string, string>();
      const after = state.commits.get(headSha) ?? new Map<string, string>();
      const paths = new Set([...before.keys(), ...after.keys()]);
      return json({
        ahead_by: baseSha === headSha ? 0 : 1,
        files: [...paths]
          .filter((path) => before.get(path) !== after.get(path))
          .map((filename) => ({
            filename,
            status: !before.has(filename)
              ? "added"
              : !after.has(filename)
                ? "removed"
                : "modified",
          })),
      });
    }
    if (path === `${repo}/branches`) {
      return json(
        url.searchParams.get("page") === "1" || !url.searchParams.has("page")
          ? [...state.branches].map(([name, sha]) => ({
              name,
              commit: { sha },
            }))
          : []
      );
    }
    if (path.startsWith(`${repo}/git/ref/heads/`)) {
      const branch = path.slice(`${repo}/git/ref/heads/`.length);
      const sha = state.branches.get(branch);
      return sha
        ? json({ ref: `refs/heads/${branch}`, object: { sha, type: "commit" } })
        : json({ message: "Reference not found" }, 404);
    }
    if (path.startsWith(`${repo}/git/matching-refs/`)) {
      const prefix = path
        .slice(`${repo}/git/matching-refs/`.length)
        .replace("heads/", "");
      return json(
        [...state.branches]
          .filter(([name]) => name.startsWith(prefix))
          .map(([name, sha]) => ({
            ref: `refs/heads/${name}`,
            object: { sha, type: "commit" },
          }))
      );
    }
    if (path.startsWith(`${repo}/rules/branches/`)) {
      if (state.rulesetsUnavailable) {
        return json(
          {
            message:
              "Upgrade to GitHub Pro or make this repository public to enable this feature.",
          },
          403
        );
      }
      if (state.protectionError) {
        return json(
          { message: "Synthetic protection outage" },
          typeof state.protectionError === "number"
            ? state.protectionError
            : 503
        );
      }
      if (state.protectionRules !== null) {
        return json(state.protectionRules.map((type) => ({ type })));
      }
      return json(
        state.rulesPR
          ? [{ type: "pull_request" }]
          : state.otherProtection
            ? [{ type: "required_status_checks" }]
            : []
      );
    }
    if (path.startsWith(`${repo}/branches/`)) {
      const rename = path.endsWith("/rename");
      const branch = path.slice(
        `${repo}/branches/`.length,
        rename ? -7 : undefined
      );
      const sha = state.branches.get(branch);
      if (!sha) {
        return json({ message: "Branch not found" }, 404);
      }
      if (rename) {
        if (state.branches.has(body.new_name)) {
          return json({ message: "Already exists" }, 422);
        }
        state.branches.delete(branch);
        state.branches.set(body.new_name, sha);
        // Real GitHub does not retarget the pull request head when renaming.
        return json({ name: body.new_name }, 201);
      }
      return json({
        name: branch,
        protected: state.omitProtected
          ? undefined
          : branch === "main"
            ? state.classicPR ||
              state.rulesPR ||
              state.otherProtection ||
              (state.protectionRules?.length ?? 0) > 0
            : state.protectedFeatures,
        commit: {
          sha,
          commit: {
            message: "Synthetic commit",
            author: { name: "Synthetic" },
          },
        },
      });
    }
    if (path.startsWith(`${repo}/git/trees/`)) {
      const ref = path.slice(`${repo}/git/trees/`.length);
      await state.beforeTree(ref);
      if (state.treeDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, state.treeDelayMs));
      }
      const files = state.commits.get(state.branches.get(ref) ?? ref);
      return json({
        truncated: false,
        tree: [...(files ?? [])].map(([path, content]) => ({
          path,
          type: "blob",
          mode: "100644",
          sha: blob(content),
          size: Buffer.byteLength(content),
        })),
      });
    }
    if (path.startsWith(`${repo}/contents/`)) {
      const file = path.slice(`${repo}/contents/`.length);
      await state.beforeRead(file);
      const ref = url.searchParams.get("ref") ?? "main";
      const content = state.commits
        .get(state.branches.get(ref) ?? ref)
        ?.get(file);
      return content === undefined
        ? json({ message: "Not found" }, 404)
        : json({
            type: "file",
            content: Buffer.from(content).toString("base64"),
            sha: blob(content),
          });
    }
    if (path === `${repo}/commits`) {
      const commits = [];
      let sha = url.searchParams.get("sha") ?? "main";
      sha = state.branches.get(sha) ?? sha;
      const contentPath = url.searchParams.get("path");
      while (commitMetadata.has(sha)) {
        const metadata = commitMetadata.get(sha)!;
        if (
          !contentPath ||
          state.commits.get(sha)?.get(contentPath) !==
            state.commits.get(metadata.parentSha)?.get(contentPath)
        ) {
          commits.push({
            sha,
            commit: { message: metadata.message },
            parents: [{ sha: metadata.parentSha }],
          });
        }
        sha = metadata.parentSha;
      }
      const page = Number(url.searchParams.get("page") ?? 1);
      const perPage = Number(url.searchParams.get("per_page") ?? 30);
      return json(commits.slice((page - 1) * perPage, page * perPage));
    }
    if (path.startsWith(`${repo}/commits/`)) {
      const sha = path.slice(`${repo}/commits/`.length);
      await state.beforeCommitMetadata(sha);
      if (state.commitMetadataError) {
        return json({ message: "Synthetic metadata outage" }, 503);
      }
      return state.commits.has(sha)
        ? json({
            sha,
            author: { login: "notra[bot]" },
            parents: [{ sha: commitMetadata.get(sha)?.parentSha ?? "initial" }],
            commit: {
              message:
                commitMetadata.get(sha)?.message ?? "Synthetic commit\nDetails",
              author: { name: "Synthetic author" },
              verification: { verified: true },
            },
          })
        : json({ message: "Not found" }, 404);
    }
    if (path === `${repo}/git/refs`) {
      const branch = body.ref.replace("refs/heads/", "");
      if (state.branches.has(branch)) {
        return json({ message: "Already exists" }, 422);
      }
      state.branches.set(branch, body.sha);
      return json({ ref: body.ref }, 201);
    }
    if (
      request.method === "DELETE" &&
      path.startsWith(`${repo}/git/refs/heads/`)
    ) {
      state.branches.delete(path.slice(`${repo}/git/refs/heads/`.length));
      return new Response(null, { status: 204 });
    }
    if (path === `${repo}/pulls`) {
      if (request.method === "POST") {
        if (state.failPR) {
          return json({ message: "Synthetic outage" }, 503);
        }
        if (state.prErrorMessage) {
          return json({ message: state.prErrorMessage }, 422);
        }
        if (body.draft && state.rejectDraft) {
          return json({ message: "Draft pull requests not supported" }, 422);
        }
        const number = state.prs.length + 1;
        const pr: FakePullRequest = {
          id: `PR_${number}`,
          node_id: `PR_${number}`,
          number,
          html_url: `https://github.com/synthetic/${repositoryName}/pull/${number}`,
          url: new URL(`/pull/${number}`, url.origin).href,
          title: body.title,
          state: "open",
          draft: body.draft ?? false,
          merged_at: null,
          head: {
            ref: body.head,
            sha: state.branches.get(body.head) ?? "",
            repo: { full_name: `synthetic/${repositoryName}` },
          },
          base: { ref: body.base },
          mergeable: "MERGEABLE",
          mergeStateStatus: "CLEAN",
          reviewDecision: null,
        };
        state.prs.push(pr);
        return json(pr, 201);
      }
      const head = url.searchParams.get("head")?.replace("synthetic:", "");
      const base = url.searchParams.get("base");
      const requestedState = url.searchParams.get("state");
      return json(
        url.searchParams.get("page") && url.searchParams.get("page") !== "1"
          ? []
          : state.prs
              .filter(
                (pr) =>
                  (!head || pr.head.ref === head) &&
                  (!base || pr.base.ref === base) &&
                  (!requestedState ||
                    requestedState === "all" ||
                    pr.state === requestedState)
              )
              .toReversed()
              .slice(0, Number(url.searchParams.get("per_page") ?? 30))
      );
    }
    const issueComments = new RegExp(`^${repo}/issues/(\\d+)/comments$`).exec(
      path
    );
    if (issueComments) {
      const issueNumber = Number(issueComments[1]);
      if (request.method === "GET") {
        return json(
          state.comments.filter(
            (comment) => comment.issueNumber === issueNumber
          )
        );
      }
      const comment = {
        id: state.comments.length + 1,
        issueNumber,
        body: body.body,
        user: { type: "Bot" },
        performed_via_github_app: {
          id: Number(process.env.GITHUB_APP_ID) || 999000,
        },
      };
      state.comments.push(comment);
      return json(comment, 201);
    }
    const commentUpdate = new RegExp(`^${repo}/issues/comments/(\\d+)$`).exec(
      path
    );
    if (commentUpdate) {
      const comment = state.comments.find(
        (entry) => entry.id === Number(commentUpdate[1])
      );
      if (!comment) {
        return json({ message: "Not found" }, 404);
      }
      comment.body = body.body;
      return json(comment);
    }
    if (path.startsWith(`${repo}/pulls/`)) {
      const number = Number(path.slice(`${repo}/pulls/`.length).split("/")[0]);
      const pr = state.prs.find((entry) => entry.number === number);
      if (!pr) {
        return json({ message: "Not found" }, 404);
      }
      if (path.endsWith("/merge")) {
        if (state.rejectedMergeMethods.includes(body.merge_method)) {
          return json({ message: "Merge method not allowed" }, 405);
        }
        if (body.sha !== state.branches.get(pr.head.ref)) {
          return json({ message: "Head changed" }, 409);
        }
        state.mergeMethod = body.merge_method;
        pr.merged_at = new Date().toISOString();
        pr.state = "closed";
        const sha = state.branches.get(pr.head.ref) ?? "";
        state.branches.set(pr.base.ref, sha);
        return json({ merged: true, sha });
      }
      if (request.method === "PATCH") {
        if (body.state) {
          pr.state = body.state;
        }
        if (body.body !== undefined) {
          pr.body = body.body;
        }
      }
      return json({
        ...pr,
        merged: Boolean(pr.merged_at),
        base: { ...pr.base, repo: { id: 500 } },
        head: {
          ...pr.head,
          repo: { ...pr.head.repo, id: 500 },
          sha: state.branches.get(pr.head.ref) ?? pr.head.sha,
        },
      });
    }
    return json(
      { message: `Unexpected fake route ${request.method} ${path}` },
      404
    );
  };
  const server = createServer(async (incoming, outgoing) => {
    const chunks: Buffer[] = [];
    for await (const chunk of incoming) {
      chunks.push(Buffer.from(chunk));
    }
    const method = incoming.method ?? "GET";
    const request = new Request(
      `http://${incoming.headers.host}${incoming.url}`,
      {
        method,
        ...(chunks.length > 0
          ? { body: Buffer.concat(chunks).toString("utf8") }
          : {}),
      }
    );
    const response = await handle(request);
    const isRename = new URL(request.url).pathname.endsWith("/rename");
    const delivered =
      isRename && state.loseRenameResponseAfter !== null
        ? state.loseRenameResponseAfter-- > 0
        : true;
    if (isRename && (state.loseRenameResponse || !delivered)) {
      outgoing.destroy();
      return;
    }
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise<void>((resolve) =>
    server.listen(port, "127.0.0.1", resolve)
  );
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Fake GitHub did not start");
  }
  return {
    state,
    url: `http://127.0.0.1:${address.port}`,
    stop: () => {
      server.closeAllConnections();
      server.close();
    },
    blob,
    push,
  };
}
