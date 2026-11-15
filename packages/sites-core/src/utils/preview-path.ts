export function safePreviewNextPath(next: string | null | undefined): string {
  if (!next?.startsWith("/") || next.includes("\\")) {
    return "/";
  }
  try {
    const base = "https://preview.invalid";
    const resolved = new URL(next, base);
    if (resolved.origin !== base) {
      return "/";
    }
    const path = `${resolved.pathname}${resolved.search}${resolved.hash}`;
    // Dot segments can normalize to "//host", which Location treats as a host.
    return path.startsWith("//") ? "/" : path;
  } catch {
    return "/";
  }
}
