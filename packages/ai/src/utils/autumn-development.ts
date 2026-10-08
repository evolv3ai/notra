import { isDemoMode } from "@notra/utils/demo-mode";

/**
 * Local development, the public demo, and self-hosted instances that set
 * NOTRA_SELF_HOSTED=true skip Autumn plan/credit gates when no Autumn key is
 * configured. Hosted production always has a key, so never bypasses.
 */
export function shouldBypassAutumnInDevelopment(
  nodeEnv: string | undefined,
  secretKey: string | undefined,
  selfHosted: string | undefined = process.env.NOTRA_SELF_HOSTED
): boolean {
  return (
    (nodeEnv === "development" || isDemoMode() || selfHosted === "true") &&
    !secretKey
  );
}
