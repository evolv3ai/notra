import { beforeEach, describe, expect, mock, test } from "bun:test";

import { Effect } from "effect";

import type { GetGitHubActivityProgramInput } from "../src/types/integrations";

let githubResponse: () => Promise<unknown>;
let requestedRoute: string | undefined;
let requestedParams: Record<string, unknown> | undefined;

mock.module("@notra/ai/integrations/github", () => ({
  getTokenForIntegrationId: async () => null,
}));

mock.module("@notra/ai/utils/octokit", () => ({
  createOctokit: () => ({
    request: (route: string, params: Record<string, unknown>) => {
      if (route === "GET /repos/{owner}/{repo}") {
        return Promise.resolve({ data: { default_branch: "trunk" } });
      }
      requestedRoute = route;
      requestedParams = params;
      return githubResponse();
    },
  }),
}));

const { getGitHubActivity } = await import("../src/programs/integrations");

const integration = {
  id: "gh_1",
  displayName: "acme/web",
  owner: "acme",
  repo: "web",
  defaultBranch: "main" as string | null,
};

function createDb(row: typeof integration | null = integration) {
  return {
    query: { githubIntegrations: { findFirst: async () => row } },
  } as never;
}

const query: GetGitHubActivityProgramInput["query"] = {
  type: "pull_requests",
  since: "2026-10-20T00:00:00Z",
  until: "2026-10-30T00:00:00Z",
  page: 1,
};

function run(overrides: Partial<typeof query> = {}, db = createDb()) {
  return Effect.runPromise(
    Effect.result(
      getGitHubActivity({
        db,
        organizationId: "org_1",
        integrationId: "gh_1",
        query: { ...query, ...overrides },
      })
    )
  );
}

describe("getGitHubActivity", () => {
  beforeEach(() => {
    requestedRoute = undefined;
    requestedParams = undefined;
  });

  test("keeps pull requests merged inside the window and pages while the window continues", async () => {
    githubResponse = async () => ({
      headers: { link: '<https://api.github.com/x?page=2>; rel="next"' },
      data: [
        {
          number: 12,
          title: "Scheduler v2",
          body: "Faster builds",
          user: { login: "jan" },
          html_url: "https://github.com/acme/web/pull/12",
          merged_at: "2026-10-28T10:00:00Z",
          updated_at: "2026-10-28T10:00:00Z",
        },
        {
          number: 11,
          title: "Closed without merge",
          body: null,
          user: { login: "jan" },
          html_url: "https://github.com/acme/web/pull/11",
          merged_at: null,
          updated_at: "2026-10-25T10:00:00Z",
        },
      ],
    });

    const result = await run();

    expect(requestedRoute).toBe("GET /repos/{owner}/{repo}/pulls");
    expect(requestedParams).toMatchObject({ base: "main", state: "closed" });
    expect(result._tag).toBe("Success");
    if (result._tag !== "Success") {
      return;
    }
    expect(result.success.items).toEqual([
      {
        ref: "12",
        title: "Scheduler v2",
        body: "Faster builds",
        author: "jan",
        url: "https://github.com/acme/web/pull/12",
        occurredAt: "2026-10-28T10:00:00Z",
      },
    ]);
    expect(result.success.pagination).toEqual({ page: 1, nextPage: 2 });
  });

  test("stops paging once GitHub returns items older than the window", async () => {
    githubResponse = async () => ({
      headers: { link: '<https://api.github.com/x?page=2>; rel="next"' },
      data: [
        {
          number: 3,
          title: "Old",
          body: null,
          user: null,
          html_url: "https://github.com/acme/web/pull/3",
          merged_at: "2026-09-01T00:00:00Z",
          updated_at: "2026-09-01T00:00:00Z",
        },
      ],
    });

    const result = await run();

    expect(result._tag).toBe("Success");
    if (result._tag !== "Success") {
      return;
    }
    expect(result.success.items).toEqual([]);
    expect(result.success.pagination.nextPage).toBeNull();
  });

  test("splits commit messages into title and body", async () => {
    githubResponse = async () => ({
      headers: {},
      data: [
        {
          sha: "abc123",
          html_url: "https://github.com/acme/web/commit/abc123",
          author: null,
          commit: {
            message: "Fix login\n\nHandles expired sessions.",
            author: { name: "Jan", date: "2026-10-29T08:00:00Z" },
          },
        },
      ],
    });

    const result = await run({ type: "commits" });

    expect(requestedParams).toMatchObject({ sha: "main" });
    expect(result._tag).toBe("Success");
    if (result._tag !== "Success") {
      return;
    }
    expect(result.success.items[0]).toMatchObject({
      ref: "abc123",
      title: "Fix login",
      body: "Handles expired sessions.",
      author: "Jan",
    });
  });

  test("fails with not found for an unknown or disabled integration", async () => {
    const result = await run({}, createDb(null));

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") {
      return;
    }
    expect(result.failure._tag).toBe("IntegrationNotFoundError");
  });

  test("reports a repository GitHub no longer exposes as an access error", async () => {
    githubResponse = () =>
      Promise.reject(Object.assign(new Error("Not Found"), { status: 404 }));

    const result = await run();

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") {
      return;
    }
    expect(result.failure._tag).toBe("GitHubAccessError");
  });

  test("treats rate limits and outages as unavailable", async () => {
    githubResponse = () =>
      Promise.reject(
        Object.assign(new Error("rate limited"), {
          status: 403,
          response: { headers: { "x-ratelimit-remaining": "0" } },
        })
      );

    const result = await run();

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") {
      return;
    }
    expect(result.failure._tag).toBe("IntegrationUnavailableError");
  });

  test("treats a secondary rate limit as unavailable", async () => {
    githubResponse = () =>
      Promise.reject(
        Object.assign(new Error("You have exceeded a secondary rate limit"), {
          status: 403,
          response: {
            headers: { "x-ratelimit-remaining": "4999", "retry-after": "60" },
          },
        })
      );

    const result = await run();

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") {
      return;
    }
    expect(result.failure._tag).toBe("IntegrationUnavailableError");
  });

  test("reports a forbidden repository as an access error", async () => {
    githubResponse = () =>
      Promise.reject(
        Object.assign(new Error("Resource not accessible"), {
          status: 403,
          response: { headers: { "x-ratelimit-remaining": "4999" } },
        })
      );

    const result = await run();

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") {
      return;
    }
    expect(result.failure._tag).toBe("GitHubAccessError");
  });

  test("resolves the repository default branch when the integration has none", async () => {
    githubResponse = async () => ({ headers: {}, data: [] });

    await run({}, createDb({ ...integration, defaultBranch: null }));

    expect(requestedParams).toMatchObject({ base: "trunk" });
  });
});
