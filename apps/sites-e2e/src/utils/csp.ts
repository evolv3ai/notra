function directiveSources(
  policy: string | null | undefined,
  directive: string
): string[] {
  const tokens = policy
    ?.split(";")
    .map((part) => part.trim().split(/\s+/))
    .find(([name]) => name === directive);
  return tokens?.slice(1) ?? [];
}

// Exact origin or a `https://*.example.com` host wildcard, nothing broader.
export function cspAllowsOrigin(
  policy: string | null | undefined,
  directive: string,
  origin: string
): boolean {
  const { protocol, host } = new URL(origin);
  return directiveSources(policy, directive).some((source) => {
    if (source === origin) {
      return true;
    }
    const wildcard = /^(https?:)\/\/\*(\.[^/*:]+)$/.exec(source);
    return (
      wildcard !== null &&
      wildcard[1] === protocol &&
      host.endsWith(wildcard[2] ?? "") &&
      host.length > (wildcard[2]?.length ?? 0)
    );
  });
}
