import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { searchWeb } from "@notra/ai/utils/context-dev";

import { REPORT_CAPTURE_METHOD } from "../scripts/state-of-ai-search/constants/collection";
import type { RawAnswer } from "../scripts/state-of-ai-search/shared";
import {
  assertReportCapture,
  reportAnswerModel,
  reportCollectionModel,
  reportCitedSources,
} from "../scripts/state-of-ai-search/utils/collection";
import { askReportContext } from "../scripts/state-of-ai-search/utils/context";
import { askReportOlostep } from "../scripts/state-of-ai-search/utils/olostep";
import { reportOverviewFallback } from "../scripts/state-of-ai-search/utils/overview";

const originalFetch = globalThis.fetch;
const originalKey = process.env.GEO_OLOSTEP_API_KEY_ENV;
const originalContextKey = process.env.CONTEXT_DEV_API_KEY;
let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "notra-soas-test-"));
  process.env.GEO_OLOSTEP_API_KEY_ENV = "test-only";
  process.env.CONTEXT_DEV_API_KEY = "test-only";
});

afterEach(async () => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) {
    delete process.env.GEO_OLOSTEP_API_KEY_ENV;
  } else {
    process.env.GEO_OLOSTEP_API_KEY_ENV = originalKey;
  }
  if (originalContextKey === undefined) {
    delete process.env.CONTEXT_DEV_API_KEY;
  } else {
    process.env.CONTEXT_DEV_API_KEY = originalContextKey;
  }
  await rm(directory, { recursive: true, force: true });
});

test("Olostep capture keeps citations and query evidence and resumes without resubmitting", async () => {
  let submissions = 0;
  globalThis.fetch = mock<typeof fetch>(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/batches") && init?.method === "POST") {
      submissions += 1;
      const body = JSON.parse(String(init.body));
      expect(body.parser.id).toBe("@olostep/chatgpt-results");
      expect(body.country).toBe("US");
      expect(body.items[0].url).toContain("q=public%20test");
      return Response.json({ id: "test-batch", status: "in_progress" });
    }
    if (url.includes("/test-batch/items?")) {
      return Response.json({
        items: [{ custom_id: "0", retrieve_id: "test-result" }],
      });
    }
    if (url.includes("/retrieve?")) {
      return Response.json({
        json_content: JSON.stringify({
          answer_markdown: "A public test answer",
          sources: [
            { url: "https://example.com/cited", cited: true },
            { url: "https://example.com/not-cited", cited: false },
          ],
          search_model_queries: [{ query: "public search" }],
        }),
      });
    }
    throw new Error(`Unexpected mock request: ${url}`);
  });
  const checkpoint = join(directory, "answer.olostep");
  const answer = await askReportOlostep(
    "openai/chatgpt",
    "public test",
    checkpoint
  );
  expect(answer.present).toBe(true);
  expect(answer.searchQueries).toEqual(["public search"]);
  expect(answer.sources.map((source) => source.url)).toEqual([
    "https://example.com/cited",
  ]);
  expect(answer).not.toHaveProperty("billing");
  expect(JSON.parse(await readFile(checkpoint, "utf8")).batchId).toBe(
    "test-batch"
  );
  await askReportOlostep("openai/chatgpt", "public test", checkpoint);
  expect(submissions).toBe(1);
});

test("ambiguous submissions are never repeated", async () => {
  const checkpoint = join(directory, "answer.olostep");
  await writeFile(
    checkpoint,
    JSON.stringify({ engine: "openai/chatgpt", prompt: "public test" })
  );
  const fetch = mock<typeof globalThis.fetch>(async () => {
    throw new Error("must not send");
  });
  globalThis.fetch = fetch;
  await expect(
    askReportOlostep("openai/chatgpt", "public test", checkpoint)
  ).rejects.toThrow("ambiguous");
  expect(fetch).not.toHaveBeenCalled();
});

test("missing AI Overview is a valid miss, empty assistant output is not", async () => {
  const checkpoint = join(directory, "answer.olostep");
  await writeFile(
    checkpoint,
    JSON.stringify({
      engine: "google/ai-overview",
      prompt: "public test",
      batchId: "test-batch",
    })
  );
  globalThis.fetch = mock<typeof fetch>(async (input) =>
    String(input).includes("/items?")
      ? Response.json({
          items: [{ custom_id: "0", retrieve_id: "test-result" }],
        })
      : Response.json({
          json_content: JSON.stringify({ message: "no-ai-overview-found" }),
        })
  );
  expect(
    (await askReportOlostep("google/ai-overview", "public test", checkpoint))
      .present
  ).toBe(false);
  await writeFile(
    checkpoint,
    JSON.stringify({
      engine: "openai/chatgpt",
      prompt: "public test",
      batchId: "test-batch",
    })
  );
  await expect(
    askReportOlostep("openai/chatgpt", "public test", checkpoint)
  ).rejects.toThrow("no answer");
});

test("Context consumer captures use the shared adapter and are cached without resubmission", async () => {
  let submissions = 0;
  globalThis.fetch = mock<typeof fetch>(async (input, init) => {
    expect(String(input)).toBe("https://api.context.dev/v1/web/scrape");
    expect(init?.method).toBe("POST");
    submissions += 1;
    return Response.json({
      url: "https://www.google.com/search?q=public+test",
      request_id: "test-context",
      html: {
        requested: true,
        success: true,
        data: '<div id="search"><a href="https://example.com"><h3>Organic result</h3></a></div>',
      },
    });
  });
  const checkpoint = join(directory, "answer.context");
  const answer = await askReportContext(
    "google/ai-overview",
    "public test",
    checkpoint
  );
  expect(answer.present).toBe(false);
  expect(answer.providerMetadata).toMatchObject({
    provider: "context.dev",
    requestId: "test-context",
  });
  await askReportContext("google/ai-overview", "public test", checkpoint);
  expect(submissions).toBe(1);
  await expect(
    askReportContext("google/ai-overview", "different prompt", checkpoint)
  ).rejects.toThrow("different request");
});

test("ambiguous Context submissions are never repeated", async () => {
  const checkpoint = join(directory, "answer.context");
  await writeFile(
    checkpoint,
    JSON.stringify({ engine: "google/gemini", prompt: "public test" })
  );
  const fetch = mock<typeof globalThis.fetch>(async () => {
    throw new Error("must not send");
  });
  globalThis.fetch = fetch;
  await expect(
    askReportContext("google/gemini", "public test", checkpoint)
  ).rejects.toThrow("ambiguous");
  expect(fetch).not.toHaveBeenCalled();
});

test("Context.dev search receives cancellation and preserves actual results", async () => {
  const controller = new AbortController();
  let requestSignal: AbortSignal | null | undefined;
  globalThis.fetch = mock<typeof fetch>(async (input, init) => {
    expect(String(input)).toBe("https://api.context.dev/v1/web/search");
    expect(JSON.parse(String(init?.body)).query).toBe("public test");
    requestSignal = init?.signal;
    return Response.json({
      query: "public test",
      results: [
        {
          url: "https://example.com",
          title: "Example",
          description: "Public evidence",
          relevance: "high",
        },
      ],
    });
  });
  const response = await searchWeb({
    query: "public test",
    timeoutMS: 1000,
    abortSignal: controller.signal,
  });
  expect(response.results[0]?.url).toBe("https://example.com");
  controller.abort();
  expect(requestSignal?.aborted).toBe(true);
});

test("historical builds retain observed models and reject mixed collection methods", () => {
  const legacy = {
    engine: "chatgpt",
    model: "openai/old-api-model",
  } as RawAnswer;
  expect(reportAnswerModel([legacy])).toBe("openai/old-api-model");
  expect(() => assertReportCapture(legacy)).toThrow("fresh SOAS_EDITION");
  const current = {
    ...legacy,
    model: reportCollectionModel("chatgpt"),
    captureMethod: REPORT_CAPTURE_METHOD,
  };
  expect(() => assertReportCapture(current)).not.toThrow();
  expect(() => reportAnswerModel([legacy, current])).toThrow("mixed capture");
});

test("Context search candidates count only when their exact URL is cited", () => {
  const sources = [
    "https://example.com/a",
    "https://example.com/ab",
    "https://example.com/uncited",
  ].map((url) => ({ url, title: "Example", domain: "example.com" }));
  expect(
    reportCitedSources(
      sources,
      "[Evidence](https://example.com/ab)\nSearched: https://example.com/uncited"
    ).map((source) => source.url)
  ).toEqual(["https://example.com/ab"]);
});

test.each([
  '[Evidence](https://example.com/a "Source title")',
  "[Evidence](https://example.com/a 'Source title')",
  "[Evidence](https://example.com/a (Source title))",
  '[Evidence](<https://example.com/a> "Source title")',
  '[Evidence][source]\n\n[source]: https://example.com/a "Source title"',
  "[Evidence][]\n\n[Evidence]: https://example.com/a",
  "[Evidence]\n\n[Evidence]: https://example.com/a",
  "<https://example.com/a>",
])("Markdown citations retain the exact destination: %s", (markdown) => {
  const source = {
    url: "https://example.com/a",
    title: "Source",
    domain: "example.com",
  };
  expect(reportCitedSources([source], markdown)).toEqual([source]);
});

test("Markdown citation parsing ignores code, images and unused definitions", () => {
  const source = {
    url: "https://example.com/a",
    title: "Source",
    domain: "example.com",
  };
  const markdown =
    "`[Fake](https://example.com/a)`\n\n```md\n[Fake](https://example.com/a)\n```\n\n![Image](https://example.com/a)\n\n[unused]: https://example.com/a";
  expect(reportCitedSources([source], markdown)).toEqual([]);
});

test("Markdown citation destinations decode entities without matching URL prefixes", () => {
  const source = {
    url: "https://example.com/a?x=1&y=2",
    title: "Source",
    domain: "example.com",
  };
  expect(
    reportCitedSources(
      [source],
      "[Evidence](https://example.com/a?x=1&amp;y=2)"
    )
  ).toEqual([source]);
});

test("fallback overview sources are reachable through its paragraph citation indexes", () => {
  const answer: RawAnswer = {
    category: "postgres",
    promptIndex: 0,
    prompt: "Which databases?",
    engine: "ai-overview",
    model: "google/ai-overview",
    sample: 0,
    collectedAt: "2099-01-01T00:00:00Z",
    present: true,
    text: "An overview answer.",
    overview: null,
    sources: [
      {
        url: "https://example.com/first",
        title: "First",
        domain: "example.com",
      },
      { url: "https://example.org/second", title: null, domain: "example.org" },
    ],
  };
  const overview = reportOverviewFallback(answer, answer.text);
  expect(overview.blocks[0]).toEqual({
    type: "paragraph",
    text: answer.text,
    refs: [0, 1],
  });
  const block = overview.blocks[0];
  expect(
    block?.type === "paragraph"
      ? block.refs.map(
          (index) =>
            overview.references.find((reference) => reference.index === index)
              ?.url
        )
      : []
  ).toEqual(answer.sources.map((source) => source.url));
  expect(
    reportOverviewFallback({ ...answer, sources: [] }, answer.text).references
  ).toEqual([]);
});

test("Olostep submissions precede capture/poll phases and batch-local item ids do not collide", async () => {
  const collector = new URL(
    "../scripts/state-of-ai-search/collect.ts",
    import.meta.url
  ).href;
  const result = spawnSync(
    process.execPath,
    [
      "--eval",
      `
    const events = [];
    let submissions = 0;
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      if (url.href === "https://api.olostep.com/v1/batches" && init?.method === "POST") {
        const id = String(submissions++);
        events.push("submit:" + id);
        return Response.json({ id, status: "in_progress" });
      }
      if (url.href === "https://api.context.dev/v1/web/scrape") {
        events.push("context");
        const request = JSON.parse(init.body);
        return Response.json({ url: request.url, request_id: "test-context", html: {
          requested: true, success: true,
          data: '<div id="search"><a href="https://example.com"><h3>Organic result</h3></a></div>'
        } });
      }
      const items = /^\\/v1\\/batches\\/(\\d+)\\/items$/.exec(url.pathname);
      if (items) {
        events.push("poll:" + items[1]);
        return Response.json({ items: [{ custom_id: "0", retrieve_id: "result-" + items[1] }] });
      }
      if (url.pathname === "/v1/retrieve") {
        const id = url.searchParams.get("retrieve_id").replace("result-", "");
        events.push("retrieve:" + id);
        return Response.json({ json_content: JSON.stringify({ answer_markdown: "Answer for batch " + id }) });
      }
      throw new Error("Unexpected mock request: " + url.href);
    };
    await import(${JSON.stringify(collector)});
    console.log("CAPTURE_EVENTS:" + JSON.stringify(events));
  `,
    ],
    {
      cwd: fileURLToPath(new URL("../../../", import.meta.url)),
      env: {
        ...process.env,
        SOAS_DRY_RUN: "0",
        SOAS_CONCURRENCY: "1",
        SOAS_EDITION: "2099-01",
        SOAS_RAW_ROOT: directory,
        SOAS_ONLY: "postgres",
        SOAS_LIMIT: "1",
        SOAS_SAMPLES: "1",
        SOAS_ENGINES: "chatgpt,perplexity,ai-overview",
      },
      encoding: "utf8",
    }
  );
  expect(result.status).toBe(0);
  expect(result.stdout).toContain(
    'CAPTURE_EVENTS:["submit:0","submit:1","context","poll:0","retrieve:0","poll:1","retrieve:1"]'
  );
  const first = JSON.parse(
    await readFile(
      join(directory, "2099-01/postgres/chatgpt/00-0.json"),
      "utf8"
    )
  );
  const second = JSON.parse(
    await readFile(
      join(directory, "2099-01/postgres/perplexity/00-0.json"),
      "utf8"
    )
  );
  expect(first.text).toBe("Answer for batch 0");
  expect(second.text).toBe("Answer for batch 1");
});

test("five-answer dry run performs no network calls or output writes", async () => {
  const collector = new URL(
    "../scripts/state-of-ai-search/collect.ts",
    import.meta.url
  ).href;
  const result = spawnSync(
    process.execPath,
    [
      "--eval",
      `globalThis.fetch = () => { throw new Error("Network forbidden in dry run"); }; await import(${JSON.stringify(collector)});`,
    ],
    {
      cwd: fileURLToPath(new URL("../../../", import.meta.url)),
      env: {
        ...process.env,
        SOAS_DRY_RUN: "1",
        SOAS_EDITION: "2099-01",
        SOAS_RAW_ROOT: directory,
        SOAS_ONLY: "postgres",
        SOAS_LIMIT: "1",
        SOAS_SAMPLES: "1",
        SOAS_ENGINES: "chatgpt,claude,gemini,perplexity,ai-overview",
        AI_GATEWAY_API_KEY: "test-only",
      },
      encoding: "utf8",
    }
  );
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("5 answers to collect");
  expect(result.stdout).toContain('"olostepItems":2');
  expect(result.stdout).toContain('"contextCaptures":2');
  expect(result.stdout).toContain("no network requests");
  expect(await readdir(directory)).toEqual([]);
});
