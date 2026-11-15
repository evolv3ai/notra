/** A path on this origin: no protocol-relative, backslash or control tricks. */
export function isSameOriginPath(value: string): boolean {
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return false;
  }
  // Browsers strip tabs/newlines from URLs: "/\t/evil.com" becomes "//evil.com".
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 0x1f || code === 0x7f) {
      return false;
    }
  }
  return true;
}

export function sanitizeReturnTo(value: string | null): string | null {
  if (!value) {
    return null;
  }
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Malformed escapes: validate the raw value instead.
  }
  return isSameOriginPath(decoded) ? decoded : null;
}
