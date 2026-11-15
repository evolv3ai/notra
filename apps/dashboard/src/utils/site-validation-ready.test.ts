import { expect, test } from "bun:test";

import { QueryClient, QueryObserver } from "@tanstack/react-query";

import { siteDraftVersion } from "./site-draft-version";
import { siteValidationReady } from "./site-validation-ready";

test("background checks retain success but failed checks and placeholder data cannot enable publication", () => {
  const settled = {
    isSuccess: true,
    isPlaceholderData: false,
    data: { ok: true },
  };
  expect(siteValidationReady(settled)).toBe(true);
  expect(siteValidationReady({ ...settled, isPlaceholderData: true })).toBe(
    false
  );
  expect(siteValidationReady({ ...settled, isSuccess: false })).toBe(false);
  expect(siteValidationReady({ ...settled, data: { ok: false } })).toBe(false);
  expect(siteValidationReady({ ...settled, data: undefined })).toBe(false);
});

test("validation uses the current draft revisions and stays enabled during a background fetch", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const drafts = [{ id: "draft", revision: 0 }];
  const key = ["validation", siteDraftVersion(drafts)];
  client.setQueryData(key, { ok: true });
  let finish = (_value: { ok: boolean }) => {};
  const observer = new QueryObserver(client, {
    queryKey: key,
    queryFn: () =>
      new Promise<{ ok: boolean }>((resolve) => {
        finish = resolve;
      }),
    staleTime: Infinity,
  });
  const unsubscribe = observer.subscribe(() => {});
  try {
    const refetching = observer.refetch();
    expect(observer.getCurrentResult().isFetching).toBe(true);
    expect(siteValidationReady(observer.getCurrentResult())).toBe(true);
    finish({ ok: true });
    await refetching;
    const changedKey = [
      "validation",
      siteDraftVersion([{ id: "draft", revision: 1 }]),
    ];
    expect(changedKey).not.toEqual(key);
    observer.setOptions({
      queryKey: changedKey,
      queryFn: async () => ({ ok: true }),
      retry: false,
    });
    expect(siteValidationReady(observer.getCurrentResult())).toBe(false);
    await observer.refetch();
    expect(siteValidationReady(observer.getCurrentResult())).toBe(true);
    observer.setOptions({
      queryKey: changedKey,
      queryFn: () => Promise.reject(new Error("Failed validation")),
      retry: false,
    });
    await observer.refetch();
    expect(observer.getCurrentResult().data?.ok).toBe(true);
    expect(observer.getCurrentResult().isError).toBe(true);
    expect(siteValidationReady(observer.getCurrentResult())).toBe(false);
  } finally {
    unsubscribe();
    client.clear();
  }
});
