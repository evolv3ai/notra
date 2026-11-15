import { expect, test } from "bun:test";

import {
  SITE_PROTECTED_SLUG_WORDS,
  SITE_SIGN_IN_SLUG_WORDS,
} from "../src/constants/moderation";
import { slugContainsWord } from "../src/utils/moderation";

test("sign-in words are matched anywhere in the slug as whole words", () => {
  for (const slug of [
    "auth",
    "acme-auth",
    "login-acme",
    "acme-sso-portal",
    "acme-sign-in",
    "verify-account",
    "acme-2fa",
  ]) {
    expect(slugContainsWord(slug, SITE_SIGN_IN_SLUG_WORDS)).toBe(true);
  }
});

test("sign-in words inside other words do not match", () => {
  for (const slug of [
    "author",
    "authors-blog",
    "blogin",
    "acme-signing",
    "design-insights",
    "passwordless-io",
  ]) {
    expect(slugContainsWord(slug, SITE_SIGN_IN_SLUG_WORDS)).toBe(false);
  }
});

test("protected words keep matching whole words only", () => {
  expect(slugContainsWord("acme-notra-blog", SITE_PROTECTED_SLUG_WORDS)).toBe(
    true
  );
  expect(slugContainsWord("notrace", SITE_PROTECTED_SLUG_WORDS)).toBe(false);
});
