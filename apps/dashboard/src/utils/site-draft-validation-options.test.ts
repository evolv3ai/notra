import { expect, test } from "bun:test";

import { QueryClient, QueryObserver } from "@tanstack/react-query";

import { siteDraftValidationOptions } from "./site-draft-validation-options";
import {
  siteValidationBlocksReview,
  siteValidationReady,
} from "./site-validation-ready";

test("autosave starts validation immediately for each revision without disabling review", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const scope = { organizationId: "synthetic", siteId: "site", branch: "main" };
  let calls = 0;
  let finish = (_result: { ok: boolean }) => {};
  const queryFn = () => {
    calls++;
    return new Promise<{ ok: boolean }>((resolve) => {
      finish = resolve;
    });
  };
  const options = (version: string, unsaved: boolean) => ({
    ...siteDraftValidationOptions(scope, version, !unsaved),
    queryFn,
  });
  const observer = new QueryObserver(client, options("draft:1", true));
  const unsubscribe = observer.subscribe(() => {});
  try {
    expect(calls).toBe(0);
    observer.setOptions(options("draft:1", false));
    expect(calls).toBe(1);
    expect(siteValidationBlocksReview(observer.getCurrentResult())).toBe(false);
    expect(siteValidationReady(observer.getCurrentResult())).toBe(false);
    finish({ ok: true });
    await observer.refetch();
    expect(siteValidationReady(observer.getCurrentResult())).toBe(true);
    observer.setOptions(options("draft:2", true));
    expect(calls).toBe(1);
    observer.setOptions(options("draft:2", false));
    expect(calls).toBe(2);
    expect(observer.getCurrentResult().data).toBeUndefined();
    expect(siteValidationBlocksReview(observer.getCurrentResult())).toBe(false);
    expect(siteValidationReady(observer.getCurrentResult())).toBe(false);
    finish({ ok: false });
    await observer.refetch();
    expect(siteValidationBlocksReview(observer.getCurrentResult())).toBe(true);
    expect(siteValidationReady(observer.getCurrentResult())).toBe(false);
  } finally {
    unsubscribe();
    client.clear();
  }
});
