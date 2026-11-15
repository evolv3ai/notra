import { createPrivateKey } from "node:crypto";

export function validateConversion(value) {
  if (
    !value ||
    !Number.isSafeInteger(value.id) ||
    value.id < 1 ||
    typeof value.slug !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug) ||
    typeof value.pem !== "string" ||
    !value.pem.startsWith("-----BEGIN ") ||
    typeof value.webhook_secret !== "string" ||
    !/^[a-zA-Z0-9_-]{16,256}$/.test(value.webhook_secret)
  ) {
    throw new Error("Invalid manifest conversion response");
  }
  const key = createPrivateKey(value.pem);
  if (key.asymmetricKeyType !== "rsa") {
    throw new Error("Invalid manifest conversion response");
  }
  return {
    GITHUB_APP_ID: String(value.id),
    GITHUB_APP_SLUG: value.slug,
    GITHUB_APP_PRIVATE_KEY: value.pem,
    GITHUB_APP_WEBHOOK_SECRET: value.webhook_secret,
  };
}
