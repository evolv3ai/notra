import { GITHUB_API_DEFAULT_URL } from "@notra/ai/constants/github";

/**
 * GitHub REST/GraphQL base URL. `GITHUB_API_URL` (also what GitHub Actions
 * sets) points it at an emulator in end-to-end tests; production uses the
 * default.
 */
export function githubApiUrl(): string {
  return (
    process.env.GITHUB_API_URL?.trim().replace(/\/+$/, "") ||
    GITHUB_API_DEFAULT_URL
  );
}
