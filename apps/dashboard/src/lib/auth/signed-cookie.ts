import { createHmac, timingSafeEqual } from "node:crypto";

import {
  deleteCookie,
  getCookie,
  getCookies,
  setCookie,
} from "@tanstack/react-start/server";
import type * as z from "zod";

import { cookieAttributes } from "@/utils/cookie-attributes";

const SIGNATURE_SEPARATOR = ".";
const KEY_CONTEXT = "notra-signed-cookie";

function getSigningKey(): Buffer {
  const password = process.env.WORKOS_COOKIE_PASSWORD;
  if (!password) {
    throw new Error("WORKOS_COOKIE_PASSWORD must be defined");
  }
  return createHmac("sha256", password).update(KEY_CONTEXT).digest();
}

function sign(encodedPayload: string): string {
  return createHmac("sha256", getSigningKey())
    .update(encodedPayload)
    .digest("base64url");
}

export async function storeSignedCookie(
  name: string,
  payload: unknown,
  maxAgeSeconds: number
) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  setCookie(name, `${encoded}${SIGNATURE_SEPARATOR}${sign(encoded)}`, {
    httpOnly: true,
    ...cookieAttributes(),
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export async function readSignedCookie<T>(
  name: string,
  schema: z.ZodType<T>
): Promise<T | null> {
  const raw = getCookie(name);
  if (!raw) {
    return null;
  }
  const separatorIndex = raw.lastIndexOf(SIGNATURE_SEPARATOR);
  if (separatorIndex === -1) {
    return null;
  }
  const encoded = raw.slice(0, separatorIndex);
  const provided = Buffer.from(raw.slice(separatorIndex + 1), "base64url");
  const expected = Buffer.from(sign(encoded), "base64url");
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    return null;
  }
  try {
    const parsed = schema.safeParse(
      JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"))
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function clearSignedCookie(name: string) {
  deleteCookie(name, { path: "/", ...cookieAttributes() });
}

export async function clearSignedCookiesWithPrefix(prefix: string) {
  for (const name of Object.keys(getCookies())) {
    if (name.startsWith(prefix)) {
      deleteCookie(name, { path: "/", ...cookieAttributes() });
    }
  }
}
