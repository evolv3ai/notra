import reservedBrandSlugs from "./reserved-brand-slugs.json";

export const SITE_PROTECTED_SLUG_WORDS: ReadonlySet<string> = new Set([
  "notra",
  "usenotra",
]);

export const SITE_SIGN_IN_SLUG_WORDS: ReadonlySet<string> = new Set([
  "2fa",
  "auth",
  "authenticate",
  "authentication",
  "log-in",
  "login",
  "logon",
  "mfa",
  "oauth",
  "openid",
  "otp",
  "passwd",
  "password",
  "sign-in",
  "sign-on",
  "signin",
  "signon",
  "sso",
  "verification",
  "verify",
]);

export const SITE_RESERVED_BRAND_SLUGS: Readonly<Record<string, string>> =
  reservedBrandSlugs;

export const SITE_NAME_REJECTION_MESSAGES = {
  granted:
    "This address is reserved for another organization. Pick a different one.",
  protected:
    "Addresses containing “notra” are reserved for Notra. Pick a different one.",
  signIn:
    "Addresses with sign-in words like “login” or “auth” look like login pages. Pick a different one.",
  offensive: "This name isn't allowed on Notra Sites. Pick a different one.",
  impersonation:
    "This name looks like another organization or a login page. Use your own organization's name.",
} as const;

export const GENERIC_TLDS = new Set([
  "app",
  "biz",
  "co",
  "com",
  "dev",
  "gg",
  "info",
  "io",
  "ai",
  "me",
  "net",
  "org",
  "sh",
  "so",
  "tv",
  "xyz",
]);
