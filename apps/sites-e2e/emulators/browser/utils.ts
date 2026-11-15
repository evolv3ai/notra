/** Vendors may omit a nonstandard port, but must report this host and page. */
export function isPageUrl(value: unknown, page: URL): boolean {
  try {
    if (typeof value !== "string") {
      return false;
    }
    const url = new URL(value);
    return (
      url.protocol === page.protocol &&
      url.hostname === page.hostname &&
      url.pathname === page.pathname &&
      url.search === page.search
    );
  } catch {
    return false;
  }
}

export function jsonOf(text: string | null): unknown {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}
