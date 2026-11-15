export function requireTestDatabaseUrl(): string {
  if (process.env.SITES_TEST_ENABLED !== "true") {
    throw new Error("SITES_TEST_ENABLED=true is required.");
  }
  const value = process.env.SITES_TEST_DATABASE_URL;
  if (!value) {
    throw new Error("SITES_TEST_DATABASE_URL is required.");
  }
  const url = new URL(value);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    url.hostname !== "127.0.0.1" ||
    !url.port ||
    url.pathname !== "/notra_server_audit" ||
    url.search !== ""
  ) {
    throw new Error(
      "Only explicit-port loopback PostgreSQL database notra_server_audit is allowed."
    );
  }
  return value;
}
