export interface DatabaseRegressionResult {
  file: string;
  passed: boolean;
  durationMs: number;
  tests: { pass: number; fail: number; skip: number };
  /** Names of the failed tests, as Bun prints them. */
  failedTests: string[];
  /** Where the suite's redacted output was saved. */
  log: string;
}
