import { expect, test } from "bun:test";

import { matchRedirect } from "@notra/sites-core/utils/redirects";

test("exact sources match with or without a trailing slash", () => {
  const rules = [
    { source: "/blog/old/", destination: "/blog/new", status: 308 as const },
  ];
  expect(matchRedirect(rules, "/blog/old")).toEqual({
    location: "/blog/new",
    status: 308,
  });
  expect(matchRedirect(rules, "/blog/old/")?.location).toBe("/blog/new");
  expect(matchRedirect(rules, "/blog/older")).toBeNull();
});

test("wildcards carry the encoded remainder", () => {
  const rules = [
    {
      source: "/docs/*",
      destination: "https://docs.example.com/*",
      status: 307 as const,
    },
  ];
  expect(matchRedirect(rules, "/docs/getting started")?.location).toBe(
    "https://docs.example.com/getting%20started"
  );
  expect(matchRedirect(rules, "/docs")?.location).toBe(
    "https://docs.example.com"
  );
});

test("locations are always valid header values", () => {
  const rules = [
    { source: "/jp", destination: "/ブログ/new", status: 308 as const },
    { source: "/nl", destination: "/a\nb", status: 308 as const },
    { source: "/kept", destination: "/a%20b?x=1#y", status: 308 as const },
  ];
  expect(matchRedirect(rules, "/jp")?.location).toBe(
    "/%E3%83%96%E3%83%AD%E3%82%B0/new"
  );
  expect(matchRedirect(rules, "/nl")?.location).toBe("/a%0Ab");
  expect(matchRedirect(rules, "/kept")?.location).toBe("/a%20b?x=1#y");
  for (const path of ["/jp", "/nl"]) {
    const location = matchRedirect(rules, path)?.location ?? "";
    expect(() => new Headers({ location })).not.toThrow();
  }
});
