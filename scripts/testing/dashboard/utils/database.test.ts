import { afterEach, expect, test } from "bun:test";

import { requireTestDatabaseUrl } from "./database";

const original = { ...process.env };
afterEach(() => {
  for (const key of ["SITES_TEST_ENABLED", "SITES_TEST_DATABASE_URL"]) {
    if (original[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original[key];
    }
  }
});

test("fixture CLI requires explicit opt-in and isolated loopback database", () => {
  delete process.env.SITES_TEST_ENABLED;
  expect(requireTestDatabaseUrl).toThrow();
  process.env.SITES_TEST_ENABLED = "true";
  for (const value of [
    "postgresql://postgres@remote.example.test:5432/notra_server_audit",
    "postgresql://postgres@localhost:5432/notra_server_audit",
    "postgresql://postgres@127.0.0.1:5432/notra",
    "postgresql://postgres@127.0.0.1/notra_server_audit",
    "postgresql://postgres@127.0.0.1:5432/notra_server_audit?host=remote.example.test",
    "https://127.0.0.1:5432/notra_server_audit",
  ]) {
    process.env.SITES_TEST_DATABASE_URL = value;
    expect(requireTestDatabaseUrl).toThrow();
  }
  process.env.SITES_TEST_DATABASE_URL =
    "postgresql://postgres@127.0.0.1:5432/notra_server_audit";
  expect(requireTestDatabaseUrl()).toBe(process.env.SITES_TEST_DATABASE_URL);
});
