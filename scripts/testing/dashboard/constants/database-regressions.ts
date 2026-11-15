export const DATABASE_REGRESSION_PORT = "55447";
export const DATABASE_REGRESSION_FILES = [
  "packages/db/tests/sites-tenant-integrity.test.ts",
  "packages/db/tests/build-telemetry-postgres.test.ts",
  "packages/sites-server/tests/github-consent.test.ts",
  "packages/sites-server/tests/deployment-admission.test.ts",
  "packages/sites-server/tests/postgres-lifecycle.test.ts",
  "packages/sites-server/tests/draft-cas-postgres.test.ts",
  "packages/sites-server/tests/smart-deployments-postgres.test.ts",
  "packages/sites-server/tests/production-projection.test.ts",
  "packages/sites-server/tests/host-reclaim.test.ts",
  "packages/sites-server/tests/organization-teardown.test.ts",
  "packages/sites-server/tests/plan-limits-postgres.test.ts",
  "apps/sites-e2e/tests/connected-lifecycle-postgres.test.ts",
  "packages/geo-core/tests/site-project-delete.test.ts",
  "apps/dashboard/tests/sites-test-status.test.ts",
] as const;
