import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { setImmediate } from "node:timers/promises";

import { GEO_OPENCODE_STALE_BOX_AGE_MS } from "@notra/ai/constants/geo-opencode";
import { BoxError } from "@upstash/box";

import {
  createGeoOpenCodeBox,
  createGeoOpenCodeBoxName,
  deleteGeoOpenCodeBox,
  deleteStaleGeoOpenCodeBoxIds,
  geoOpenCodeBoxErrorMessage,
  isStaleGeoOpenCodeBox,
  recoverAndDeleteGeoOpenCodeBox,
  withGeoOpenCodeBoxRetry,
} from "./geo-opencode-box";

const originalFetch = globalThis.fetch;
const requests: { url: string; init?: RequestInit }[] = [];
let responses: (() => Response | Promise<Response>)[];

function create(signal = new AbortController().signal) {
  return createGeoOpenCodeBox(
    "notra-geo-test",
    "test-box-key",
    "test-model-key",
    signal,
    100
  );
}

beforeEach(() => {
  requests.length = 0;
  responses = [];
  globalThis.fetch = mock<typeof fetch>(async (input, init) => {
    requests.push({ url: String(input), init });
    const response = responses.shift();
    if (!response) {
      throw new Error("Unexpected mocked Box request");
    }
    return response();
  });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("GEO Box creation and recovery", () => {
  test("names boxes with independent sweepable UUIDs", () => {
    const first = createGeoOpenCodeBoxName();
    expect(first).toMatch(/^notra-geo-[\da-f-]{36}$/u);
    expect(createGeoOpenCodeBoxName()).not.toBe(first);
  });

  test("does not send a create request for an already cancelled operation", async () => {
    const failure = new Error("already cancelled");
    await expect(create(AbortSignal.abort(failure))).rejects.toBe(failure);
    expect(requests).toHaveLength(0);
  });

  test("cleans up even if the ready response races cancellation", async () => {
    const controller = new AbortController();
    const failure = new Error("cancelled at creation completion");
    responses = [
      () => {
        controller.abort(failure);
        return Response.json({
          id: "box-1",
          status: "idle",
          agent: "opencode",
        });
      },
      () => new Response(null, { status: 204 }),
    ];
    await expect(create(controller.signal)).rejects.toBe(failure);
    expect(requests.at(-1)?.init?.method).toBe("DELETE");
  });

  test("polls creating boxes before returning a configured SDK instance", async () => {
    responses = [
      () => Response.json({ id: "box-1", status: "creating" }),
      () =>
        Response.json({
          id: "box-1",
          status: "idle",
          agent: "opencode",
          model: "test-model",
        }),
    ];
    const pending = create();
    await setImmediate();
    expect(requests).toHaveLength(1);
    const box = await pending;
    expect(box.id).toBe("box-1");
    expect(box.modelConfig.harness).toBe("opencode");
    expect(requests[1]?.url).toEndWith("/v2/box/box-1");
  });

  test("stops waiting for a creating box as soon as the caller cancels", async () => {
    const controller = new AbortController();
    const failure = new Error("cancelled while creating");
    responses = [
      () => Response.json({ id: "box-1", status: "creating" }),
      () => new Response(null, { status: 204 }),
    ];
    const pending = create(controller.signal);
    await setImmediate();
    const abortedAt = performance.now();
    controller.abort(failure);
    await expect(pending).rejects.toBe(failure);
    expect(performance.now() - abortedAt).toBeLessThan(500);
    expect(requests.map((request) => request.init?.method)).toEqual([
      "POST",
      "DELETE",
    ]);
  });

  test("cleans up a box that enters the error state", async () => {
    responses = [
      () => Response.json({ id: "box-1", status: "error" }),
      () => new Response(null, { status: 204 }),
    ];
    await expect(create()).rejects.toThrow("Box creation failed");
    expect(requests[1]?.init?.method).toBe("DELETE");
  });

  test("does not accept a deleted box as ready", async () => {
    responses = [
      () => Response.json({ id: "box-1", status: "deleted" }),
      () => new Response(null, { status: 204 }),
    ];
    await expect(create()).rejects.toThrow("unexpected status");
    expect(requests[1]?.init?.method).toBe("DELETE");
  });

  test("rejects permanent polling errors instead of waiting until the deadline", async () => {
    responses = [
      () => Response.json({ id: "box-1", status: "creating" }),
      () => Response.json({ error: "poll forbidden" }, { status: 403 }),
      () => new Response(null, { status: 204 }),
    ];
    const pending = expect(create()).rejects.toMatchObject({
      statusCode: 403,
      message: "poll forbidden",
    });
    await setImmediate();
    await pending;
    expect(requests.at(-1)?.init?.method).toBe("DELETE");
  });

  test("recovers by name after a POST transport failure without reissuing the POST", async () => {
    const failure = new TypeError("fetch failed");
    responses = [
      () => {
        throw failure;
      },
      () => Response.json({ id: "recovered-box" }),
      () => new Response(null, { status: 204 }),
    ];
    await expect(create()).rejects.toBe(failure);
    expect(requests.map(({ init }) => init?.method ?? "GET")).toEqual([
      "POST",
      "GET",
      "DELETE",
    ]);
    expect(requests[1]?.url).toEndWith("/v2/box/notra-geo-test");
    expect(JSON.parse(String(requests[2]?.init?.body))).toEqual({
      ids: ["recovered-box"],
    });
    expect(requests[2]?.init?.signal?.aborted).toBe(false);
  });

  test("recovers ambiguous server failures after POST", async () => {
    responses = [
      () =>
        Response.json(
          { error: "gateway failed after provisioning" },
          { status: 502 }
        ),
      () => Response.json({ id: "recovered-box" }),
      () => new Response(null, { status: 204 }),
    ];
    await expect(create()).rejects.toMatchObject({ statusCode: 502 });
    expect(requests.map(({ init }) => init?.method ?? "GET")).toEqual([
      "POST",
      "GET",
      "DELETE",
    ]);
  });

  test("does not recover a definitively rejected create request", async () => {
    responses = [
      () => Response.json({ error: "bad API key" }, { status: 401 }),
    ];
    await expect(create()).rejects.toMatchObject({ statusCode: 401 });
    expect(requests).toHaveLength(1);
  });

  test("recovers a success response missing the box ID", async () => {
    responses = [
      () => Response.json({ status: "idle" }),
      () => Response.json({ id: "recovered-box" }),
      () => new Response(null, { status: 204 }),
    ];
    await expect(create()).rejects.toThrow("no box ID");
    expect(requests.at(-1)?.init?.method).toBe("DELETE");
  });

  test("uses a fresh cleanup signal when provisioning is cancelled", async () => {
    const controller = new AbortController();
    const failure = new Error("creation cancelled");
    responses = [
      () => {
        controller.abort(failure);
        return Response.json({ id: "box-1", status: "creating" });
      },
      () => new Response(null, { status: 204 }),
    ];
    await expect(create(controller.signal)).rejects.toBe(failure);
    expect(requests.at(-1)?.init?.signal?.aborted).toBe(false);
  });

  test("preserves both provisioning and recovery errors", async () => {
    responses = [
      () => {
        throw new Error("POST transport failure");
      },
      () => new Response(null, { status: 401 }),
    ];
    try {
      await create();
      throw new Error("Expected aggregate failure");
    } catch (error) {
      expect(error).toBeInstanceOf(AggregateError);
      expect((error as AggregateError).errors).toHaveLength(2);
      expect((error as AggregateError).errors[0].message).toBe(
        "POST transport failure"
      );
      expect((error as AggregateError).errors[1].statusCode).toBe(401);
    }
  });

  test("encodes recovery names rather than interpolating query or path components", async () => {
    responses = [
      () => Response.json({ id: "box-1" }),
      () => new Response(null, { status: 204 }),
    ];
    expect(
      await recoverAndDeleteGeoOpenCodeBox(
        "name/with?query#fragment",
        "test-box-key"
      )
    ).toBe(true);
    expect(requests[0]?.url).toEndWith("name%2Fwith%3Fquery%23fragment");
  });
});

describe("GEO Box cleanup and retry policy", () => {
  test.each([408, 429, 500, 503])(
    "retries transient HTTP %i",
    async (status) => {
      const callback = mock(async () => {
        if (callback.mock.calls.length < 3) {
          throw new BoxError("transient", status);
        }
        return "done";
      });
      expect(await withGeoOpenCodeBoxRetry(callback, { retryDelayMs: 0 })).toBe(
        "done"
      );
      expect(callback).toHaveBeenCalledTimes(3);
    }
  );

  test.each([400, 401, 403, 404])(
    "does not retry permanent HTTP %i",
    async (status) => {
      const failure = new BoxError("permanent", status);
      const callback = mock(async () => {
        throw failure;
      });
      await expect(
        withGeoOpenCodeBoxRetry(callback, { retryDelayMs: 0 })
      ).rejects.toBe(failure);
      expect(callback).toHaveBeenCalledTimes(1);
    }
  );

  test("can retry 404 while waiting for a just-created box to become visible", async () => {
    const callback = mock(async () => {
      if (callback.mock.calls.length === 1) {
        throw new BoxError("not visible", 404);
      }
      return "visible";
    });
    expect(
      await withGeoOpenCodeBoxRetry(callback, {
        retryNotFound: true,
        retryDelayMs: 0,
      })
    ).toBe("visible");
  });

  test("stops retry backoff promptly on cancellation", async () => {
    const controller = new AbortController();
    const failure = new Error("cancelled during retry");
    const callback = mock(async () => {
      throw new BoxError("transient", 503);
    });
    const pending = withGeoOpenCodeBoxRetry(callback, {
      signal: controller.signal,
    });
    await setImmediate();
    controller.abort(failure);
    await expect(pending).rejects.toBe(failure);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test("treats deletion of an already absent box as success", async () => {
    responses = [() => new Response(null, { status: 404 })];
    await deleteGeoOpenCodeBox("box-1", "test-box-key");
    expect(requests).toHaveLength(1);
  });

  test("continues stale cleanup after individual failures and aggregates them", async () => {
    const failure = new Error("cannot delete first");
    const remove = mock(async (id: string) => {
      if (id === "first") {
        throw failure;
      }
    });
    await expect(
      deleteStaleGeoOpenCodeBoxIds(["first", "second"], remove)
    ).rejects.toMatchObject({ errors: [failure] });
    expect(remove.mock.calls).toEqual([["first"], ["second"]]);
  });

  test("only sweeps owned boxes at the stale boundary with seconds or milliseconds", () => {
    const now = 1_800_000_000_000;
    const stale = now - GEO_OPENCODE_STALE_BOX_AGE_MS;
    expect(
      isStaleGeoOpenCodeBox({ name: "notra-geo-owned", created_at: stale }, now)
    ).toBe(true);
    expect(
      isStaleGeoOpenCodeBox(
        { name: "notra-geo-owned", created_at: stale / 1000 },
        now
      )
    ).toBe(true);
    expect(
      isStaleGeoOpenCodeBox(
        { name: "notra-geo-owned", created_at: stale + 1 },
        now
      )
    ).toBe(false);
    expect(
      isStaleGeoOpenCodeBox({ name: "other-agent", created_at: 1 }, now)
    ).toBe(false);
    expect(isStaleGeoOpenCodeBox({ created_at: 1 }, now)).toBe(false);
    expect(
      isStaleGeoOpenCodeBox(
        { name: "notra-geo-future", created_at: now + 1000 },
        now
      )
    ).toBe(false);
  });

  test("uses structured errors and falls back safely for non-JSON responses", async () => {
    expect(
      await geoOpenCodeBoxErrorMessage(
        Response.json({ error: "provider failed" })
      )
    ).toBe("provider failed");
    expect(
      await geoOpenCodeBoxErrorMessage(
        new Response("<html>failure</html>", { status: 502 })
      )
    ).toBe("Request failed with status 502");
    expect(
      await geoOpenCodeBoxErrorMessage(
        Response.json({ error: { detail: "nested" } }, { status: 403 })
      )
    ).toBe("Request failed with status 403");
  });
});
