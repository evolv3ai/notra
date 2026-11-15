import { expect, test } from "bun:test";

import { getDemoRequestHostname } from "./demo-request-hostname";

test("prefers the proxy's public host over internal addresses", () => {
  const request = new Request("http://127.0.0.1:8080/api/demo/sandbox", {
    headers: {
      "x-forwarded-host": "DEMO.example.com:443",
      host: "127.0.0.1:8080",
    },
  });
  expect(getDemoRequestHostname(request)).toBe("demo.example.com");
});

test("direct requests fall back to the URL hostname", () => {
  expect(
    getDemoRequestHostname(
      new Request("http://localhost:3000/api/demo/sandbox")
    )
  ).toBe("localhost");
});

test.each([
  "demo.example.com,attacker.example",
  "user@demo.example.com",
  "demo.example.com/path",
  "demo.example.com?x=1",
  "demo.example.com#fragment",
  "://",
])("rejects malformed or ambiguous forwarded hosts: %s", (host) => {
  expect(
    getDemoRequestHostname(
      new Request("https://demo.example.com", {
        headers: { "x-forwarded-host": host },
      })
    )
  ).toBe("");
});
