export function requireCloudflareTestAccountId(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{32}$/.test(value)) {
    throw new Error(
      "Set an explicit SITES_E2E_CLOUDFLARE_ACCOUNT_ID; production/local R2 account defaults are never used for new tests"
    );
  }
  return value;
}

export function requireCloudflareTestProfile(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(value)
  ) {
    throw new Error(
      "Set an explicit SITES_E2E_WRANGLER_PROFILE; temporary directories do not inherit the company checkout's auth profile"
    );
  }
  return value;
}
