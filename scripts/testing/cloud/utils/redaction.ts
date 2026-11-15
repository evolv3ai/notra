export function readCloudPreviewSecret(config: unknown): string {
  if (typeof config !== "object" || config === null || !("vars" in config)) {
    throw new Error("Owned Wrangler config is missing preview-secret metadata");
  }
  const vars = config.vars;
  if (
    typeof vars !== "object" ||
    vars === null ||
    !("PREVIEW_SECRET" in vars) ||
    typeof vars.PREVIEW_SECRET !== "string" ||
    !vars.PREVIEW_SECRET
  ) {
    throw new Error("Owned Wrangler config is missing a preview secret");
  }
  return vars.PREVIEW_SECRET;
}

export function redactCloudOutput(output: string, secrets: readonly string[]) {
  return secrets
    .filter(Boolean)
    .reduce((text, secret) => text.replaceAll(secret, "[redacted]"), output);
}
