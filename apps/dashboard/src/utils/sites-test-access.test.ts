import { afterEach, expect, test } from "bun:test";

import { isSitesTestRequestAllowed } from "./sites-test-access";

const original = { ...process.env };

afterEach(() => {
  for (const key of ["NODE_ENV", "SITES_TEST_ENABLED", "DATABASE_URL"]) {
    if (original[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original[key];
    }
  }
});

test("Sites test status is opt-in, development-only, and isolated", () => {
  process.env.NODE_ENV = "development";
  process.env.DATABASE_URL =
    "postgresql://postgres:synthetic@127.0.0.1:5432/notra_server_audit";
  const request = new Request("http://localhost:3000/__tests/sites", {
    headers: { host: "localhost:3000" },
  });
  delete process.env.SITES_TEST_ENABLED;
  expect(isSitesTestRequestAllowed(request)).toBe(false);
  process.env.SITES_TEST_ENABLED = "true";
  expect(isSitesTestRequestAllowed(request)).toBe(true);
  process.env.NODE_ENV = "production";
  expect(isSitesTestRequestAllowed(request)).toBe(false);
  process.env.NODE_ENV = "development";
  for (const url of [
    "postgresql://postgres@remote.example.test/notra_server_audit",
    "postgresql://postgres@127.0.0.1/notra",
    "postgresql://postgres@127.0.0.1/notra_server_audit?host=remote.example.test",
  ]) {
    process.env.DATABASE_URL = url;
    expect(isSitesTestRequestAllowed(request)).toBe(false);
  }
});

test("Sites test status rejects tunnels and forwarded hosts", () => {
  process.env.NODE_ENV = "development";
  process.env.SITES_TEST_ENABLED = "true";
  process.env.DATABASE_URL =
    "postgresql://postgres@127.0.0.1:55447/notra_server_audit";
  expect(
    isSitesTestRequestAllowed(
      new Request("http://localhost:3000/__tests/sites", {
        headers: new Headers({ host: "localhost:3000" }),
      })
    )
  ).toBe(true);
  for (const headers of [
    new Headers({ host: "staging.example.test" }),
    new Headers({ host: "0.0.0.0:3000" }),
    new Headers({ host: "localhost:3000", "x-forwarded-for": "203.0.113.1" }),
    new Headers({ host: "localhost:3000", "cf-ray": "synthetic" }),
    new Headers({
      host: "localhost:3000",
      forwarded: "host=staging.example.test",
    }),
    new Headers({ host: "localhost:3000", "x-forwarded-host": "localhost" }),
  ]) {
    expect(
      isSitesTestRequestAllowed(
        new Request("http://localhost:3000/__tests/sites", { headers })
      )
    ).toBe(false);
  }
});
