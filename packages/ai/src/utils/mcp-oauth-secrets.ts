import {
  decryptToken,
  encryptToken,
} from "@notra/db/utils/integration-encryption";
import type { z } from "zod";

export function encryptMcpOAuthSecret(value: unknown) {
  return encryptToken(JSON.stringify(value));
}

export function decryptMcpOAuthSecret<T>(
  encryptedValue: string | null | undefined,
  schema: z.ZodType<T>
): T | undefined {
  if (!encryptedValue) {
    return undefined;
  }

  return schema.parse(JSON.parse(decryptToken(encryptedValue)));
}
