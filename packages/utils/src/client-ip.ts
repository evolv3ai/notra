import { CLOUDFLARE_IP_RANGES } from "./constants/cloudflare-ips";
import type { ParsedIp } from "./types/client-ip";

const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const HEXTET_PATTERN = /^[0-9a-f]{1,4}$/i;
const BRACKETS_PATTERN = /^\[|\]$/g;
const IPV4_BITS = 32;
const IPV6_BITS = 128;
const HEXTET_BITS = 16n;
const HEXTET_MASK = 0xff_ffn;
const IPV4_MAPPED_PREFIX = 0xff_ffn;
const IPV4_MASK = 0xff_ff_ff_ffn;
const IPV6_NETWORK_HEXTETS = 4;

function parseIpv4(raw: string): bigint | null {
  const match = IPV4_PATTERN.exec(raw);
  if (!match) {
    return null;
  }
  let value = 0n;
  for (const part of match.slice(1)) {
    const octet = Number(part);
    if (octet > 255) {
      return null;
    }
    value = (value << 8n) | BigInt(octet);
  }
  return value;
}

function parseHextets(raw: string): string[] | null {
  if (raw === "") {
    return [];
  }
  const parts = raw.split(":");
  const last = parts.at(-1) ?? "";
  if (last.includes(".")) {
    const ipv4 = parseIpv4(last);
    if (ipv4 === null) {
      return null;
    }
    parts.splice(
      -1,
      1,
      ((ipv4 >> HEXTET_BITS) & HEXTET_MASK).toString(16),
      (ipv4 & HEXTET_MASK).toString(16)
    );
  }
  return parts.every((part) => HEXTET_PATTERN.test(part)) ? parts : null;
}

function parseIpv6(raw: string): bigint | null {
  const halves = raw.split("::");
  if (halves.length > 2) {
    return null;
  }
  const head = parseHextets(halves[0] ?? "");
  const tail = halves.length === 2 ? parseHextets(halves[1] ?? "") : [];
  if (!(head && tail)) {
    return null;
  }
  const missing = 8 - head.length - tail.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) {
    return null;
  }
  let value = 0n;
  for (const hextet of [
    ...head,
    ...Array.from({ length: missing }, () => "0"),
    ...tail,
  ]) {
    value = (value << HEXTET_BITS) | BigInt(Number.parseInt(hextet, 16));
  }
  return value;
}

/** IPv4 or IPv6 (IPv4-mapped addresses count as IPv4); null if malformed. */
export function parseIp(input: string): ParsedIp | null {
  const raw = input.trim().replace(BRACKETS_PATTERN, "").split("%")[0] ?? "";
  if (!raw.includes(":")) {
    const value = parseIpv4(raw);
    return value === null ? null : { version: 4, value };
  }
  const value = parseIpv6(raw);
  if (value === null) {
    return null;
  }
  if (value >> 32n === IPV4_MAPPED_PREFIX) {
    return { version: 4, value: value & IPV4_MASK };
  }
  return { version: 6, value };
}

function parseCidr(cidr: string) {
  const [address = "", prefix = ""] = cidr.split("/");
  const ip = parseIp(address);
  if (!ip) {
    throw new Error(`Invalid CIDR range: ${cidr}`);
  }
  const bits = ip.version === 4 ? IPV4_BITS : IPV6_BITS;
  const shift = BigInt(bits - Number(prefix));
  return { version: ip.version, shift, network: ip.value >> shift };
}

const CLOUDFLARE_NETWORKS = CLOUDFLARE_IP_RANGES.map(parseCidr);

export function isCloudflareIp(ip: ParsedIp): boolean {
  return CLOUDFLARE_NETWORKS.some(
    (range) =>
      range.version === ip.version && ip.value >> range.shift === range.network
  );
}

/**
 * The key a per-network limit should count against: the IPv4 address, or
 * the /64 of an IPv6 one, since a single subscriber can rotate through
 * every address in their /64 for free.
 */
export function ipNetworkKey(ip: ParsedIp): string {
  if (ip.version === 4) {
    return [24n, 16n, 8n, 0n]
      .map((shift) => Number((ip.value >> shift) & 0xffn))
      .join(".");
  }
  const hextets: string[] = [];
  for (let index = 7; index >= 8 - IPV6_NETWORK_HEXTETS; index -= 1) {
    hextets.push(
      ((ip.value >> (HEXTET_BITS * BigInt(index))) & HEXTET_MASK).toString(16)
    );
  }
  return `${hextets.join(":")}::/64`;
}

function trustedIp(value: string | null | undefined): string | null {
  const address = value?.trim();
  return address && parseIp(address) ? address : null;
}

let warnedNoTrustedSource = false;

/**
 * The visitor's address, read only from a header the deployment says its
 * edge sets, so a client cannot spoof it:
 * 1. On Vercel (`VERCEL=1`), the first `x-vercel-forwarded-for` entry.
 * 2. Behind Unkey (`UNKEY_DEPLOYMENT_ID` set), `x-forwarded-for`, which Unkey
 *    replaces with one client IP.
 * 3. Elsewhere, only the header named by `TRUSTED_PROXY_HEADER` (for example
 *    `x-real-ip`), which must hold exactly one address. Unset, nothing is
 *    trusted, because a directly exposed server would accept any value.
 * Under 2 and 3, `cf-connecting-ip` replaces that peer only when the peer is
 * a Cloudflare edge. Returns the address as the header carries it, or null
 * when no header is trusted or it is missing or malformed.
 */
export function getClientIp(headers: Headers): string | null {
  if (process.env.VERCEL === "1") {
    return trustedIp(headers.get("x-vercel-forwarded-for")?.split(",")[0]);
  }
  const header = process.env.UNKEY_DEPLOYMENT_ID
    ? "x-forwarded-for"
    : process.env.TRUSTED_PROXY_HEADER?.trim();
  if (!header) {
    if (process.env.NODE_ENV === "production" && !warnedNoTrustedSource) {
      warnedNoTrustedSource = true;
      console.warn(
        "No trusted client IP header: set TRUSTED_PROXY_HEADER to the header your proxy overwrites. IP rate limits share one bucket until then."
      );
    }
    return null;
  }
  const peer = trustedIp(headers.get(header));
  const parsedPeer = peer ? parseIp(peer) : null;
  if (!(parsedPeer && isCloudflareIp(parsedPeer))) {
    return peer;
  }
  return trustedIp(headers.get("cf-connecting-ip")) ?? peer;
}

/** {@link getClientIp}, grouped with {@link ipNetworkKey}. */
export function getClientNetworkKey(headers: Headers): string | null {
  const ip = parseIp(getClientIp(headers) ?? "");
  return ip ? ipNetworkKey(ip) : null;
}
