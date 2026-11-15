const IPV6_GROUPS = 8;
const IPV6_PREFIX_GROUPS = 4;

/**
 * Rate-limit key for a client address. IPv6 clients usually control a whole
 * /64, so they're keyed by that prefix instead of the full address.
 */
export function rateLimitClientKey(ip: string): string {
  if (!ip.includes(":")) {
    return ip;
  }
  // IPv4-mapped (`::ffff:192.0.2.1`): key by the IPv4 address.
  if (ip.includes(".")) {
    return ip.slice(ip.lastIndexOf(":") + 1);
  }
  const [head = "", tail, ...extra] = ip.toLowerCase().split("::");
  if (extra.length > 0) {
    return ip;
  }
  const headGroups = head ? head.split(":") : [];
  const tailGroups = tail ? tail.split(":") : [];
  const missing = IPV6_GROUPS - headGroups.length - tailGroups.length;
  if (missing < 0 || (tail === undefined && missing !== 0)) {
    return ip;
  }
  const groups = [
    ...headGroups,
    ...Array.from({ length: missing }, () => "0"),
    ...tailGroups,
  ];
  return `${groups
    .slice(0, IPV6_PREFIX_GROUPS)
    .map((group) => group.replace(/^0+(?=.)/, ""))
    .join(":")}::/64`;
}

const IPV4_REGEX = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6_GROUP_REGEX = /^[\da-f]{1,4}$/;

function ipv4Octets(ip: string): number[] | undefined {
  const octets = IPV4_REGEX.exec(ip)?.slice(1).map(Number);
  return octets?.every((octet) => octet <= 255) ? octets : undefined;
}

function isPublicIpv4([a = 0, b = 0]: number[]): boolean {
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

/** The eight 16-bit groups of an IPv6 address in any valid spelling. */
function ipv6Groups(ip: string): number[] | undefined {
  let address = ip;
  if (address.includes(".")) {
    const at = address.lastIndexOf(":");
    const octets = ipv4Octets(address.slice(at + 1));
    if (!octets) {
      return undefined;
    }
    const [a = 0, b = 0, c = 0, d = 0] = octets;
    address = `${address.slice(0, at + 1)}${(a * 256 + b).toString(16)}:${(c * 256 + d).toString(16)}`;
  }
  const halves = address.split("::");
  if (halves.length > 2) {
    return undefined;
  }
  const [head = [], tail = []] = halves.map((half) =>
    half ? half.split(":") : []
  );
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) {
    return undefined;
  }
  const groups = [
    ...head,
    ...Array.from({ length: halves.length === 2 ? missing : 0 }, () => "0"),
    ...tail,
  ];
  return groups.every((group) => IPV6_GROUP_REGEX.test(group))
    ? groups.map((group) => Number.parseInt(group, 16))
    : undefined;
}

/** Whether a forwarded address can be a visitor on the public internet. */
export function isPublicIp(value: string): boolean {
  const ip = value.toLowerCase();
  if (!ip.includes(":")) {
    const octets = ipv4Octets(ip);
    return octets !== undefined && isPublicIpv4(octets);
  }
  const groups = ipv6Groups(ip);
  if (!groups) {
    return false;
  }
  const [first = 0, , , , , sixth = 0, seventh = 0, last = 0] = groups;
  const zeroPrefix = groups.slice(0, 5).every((group) => group === 0);
  if (zeroPrefix && sixth === 0xff_ff) {
    return isPublicIpv4([seventh >> 8, seventh & 0xff]);
  }
  if (zeroPrefix && sixth === 0 && seventh === 0 && last <= 1) {
    return false;
  }
  return (first & 0xfe_00) !== 0xfc_00 && (first & 0xff_c0) !== 0xfe_80;
}

/**
 * The visitor address a reverse proxy put in `X-Forwarded-For`. Proxies
 * append to the header, so only the right end is trustworthy: the entry
 * Cloudflare appended for the proxy itself and the proxy's internal hops are
 * skipped, and anything further left is whatever the visitor sent.
 */
export function forwardedClientIp(
  forwardedFor: string | null,
  connectingIp: string | undefined
): string | undefined {
  const hops = (forwardedFor ?? "")
    .split(",")
    .map((hop) => hop.trim())
    .filter(Boolean);
  if (hops.at(-1) === connectingIp) {
    hops.pop();
  }
  return hops.findLast(isPublicIp);
}
