import { afterEach, expect, test } from "bun:test";

import { readStoredRecords } from "@c15t/core/modules/persistence";

import {
  dropSharedConsentCookie,
  migrateLegacyRefusal,
} from "../src/utils/consent-migration";

const HOST_KEY = "__Host-c15t";
const globals = globalThis as Record<string, unknown>;

const record = (measurement: boolean, time = Date.now() - 1000) =>
  encodeURIComponent(
    JSON.stringify({
      consents: { necessary: true, measurement },
      consentInfo: { time, type: measurement ? "all" : "necessary" },
    })
  );

function browser(cookies: string[], local: Record<string, string> = {}) {
  const jar = [...cookies];
  const storage = new Map(Object.entries(local));
  const localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  };
  globals.document = {
    get cookie() {
      return jar.join("; ");
    },
    set cookie(value: string) {
      jar.push(value.split(";")[0] ?? "");
    },
  };
  globals.localStorage = localStorage;
  globals.window = { localStorage };
  return jar;
}

const stored = () =>
  readStoredRecords({ storageKey: HOST_KEY }, Date.now()).records.choice
    ?.categories.measurement?.value;

afterEach(() => {
  delete globals.document;
  delete globals.localStorage;
  delete globals.window;
});

test("a refusal in any c15t cookie is carried over, even behind a forged newer grant", () => {
  const jar = browser([
    `c15t=${record(true, Date.now())}`,
    `c15t=${record(false)}`,
  ]);
  migrateLegacyRefusal(HOST_KEY);
  expect(jar.at(-1)?.startsWith(`${HOST_KEY}=`)).toBe(true);
  expect(stored()).toBe(false);
});

test("a refusal in this origin's c15t localStorage record is carried over", () => {
  browser([`c15t=${record(true, Date.now())}`], {
    c15t: decodeURIComponent(record(false)),
  });
  migrateLegacyRefusal(HOST_KEY);
  expect(stored()).toBe(false);
});

test("a refusal beats a choice c15t kept only in localStorage under the host key", () => {
  browser([`c15t=${record(false)}`], {
    [HOST_KEY]: decodeURIComponent(record(true, Date.now())),
  });
  migrateLegacyRefusal(HOST_KEY);
  expect(stored()).toBe(false);
});

test("a stored grant is never carried over", () => {
  const jar = browser([`c15t=${record(true)}`], {
    c15t: decodeURIComponent(record(true)),
  });
  migrateLegacyRefusal(HOST_KEY);
  expect(jar).toHaveLength(1);
  expect(stored()).toBeUndefined();
});

test("an existing host-only choice is left alone", () => {
  const jar = browser([`${HOST_KEY}=${record(true)}`, `c15t=${record(false)}`]);
  migrateLegacyRefusal(HOST_KEY);
  expect(jar).toHaveLength(2);
  expect(stored()).toBe(true);
});

test("a c15t cookie on the hosting domain is expired before c15t reads it", () => {
  const writes: string[] = [];
  globals.document = {
    get cookie() {
      return "";
    },
    set cookie(value: string) {
      writes.push(value);
    },
  };
  dropSharedConsentCookie("notra.site");
  expect(writes).toEqual(["c15t=; Domain=.notra.site; Path=/; Max-Age=0"]);
});
