import type { LookupAddress } from "node:dns";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata",
  "metadata.google.internal",
]);

const BLOCKED_HOSTNAME_SUFFIXES = [".internal", ".local", ".localhost"];
const HEXTET_REGEX = /^[0-9a-f]{1,4}$/;

export class PublicUrlValidationError extends Error {
  readonly reason: "invalid" | "not_found" | "temporary";

  constructor(
    message: string,
    reason: "invalid" | "not_found" | "temporary" = "invalid"
  ) {
    super(message);
    this.name = "PublicUrlValidationError";
    this.reason = reason;
  }
}

export function isSameUrl(url: string, previousUrl: string | null): boolean {
  const current = URL.parse(url);
  const previous = previousUrl ? URL.parse(previousUrl) : null;
  return (
    current !== null && previous !== null && current.href === previous.href
  );
}

function ipv4ToNumber(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) {
    return null;
  }

  let result = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) {
      return null;
    }
    result = result * 256 + octet;
  }
  return result;
}

function isPrivateOrReservedIpv4(ip: string): boolean {
  const value = ipv4ToNumber(ip);
  if (value === null) {
    return true;
  }

  const ranges: [number, number][] = [
    [0x00_00_00_00, 0x00_ff_ff_ff],
    [0x0a_00_00_00, 0x0a_ff_ff_ff],
    [0x64_40_00_00, 0x64_7f_ff_ff],
    [0x7f_00_00_00, 0x7f_ff_ff_ff],
    [0xa9_fe_00_00, 0xa9_fe_ff_ff],
    [0xac_10_00_00, 0xac_1f_ff_ff],
    [0xc0_a8_00_00, 0xc0_a8_ff_ff],
    [0xe0_00_00_00, 0xff_ff_ff_ff],
  ];

  return ranges.some(([start, end]) => value >= start && value <= end);
}

type Ipv6Hextets = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

function expandIpv6Hextets(ip: string): Ipv6Hextets | null {
  let address = ip.toLowerCase();

  const zoneIndex = address.indexOf("%");
  if (zoneIndex !== -1) {
    address = address.slice(0, zoneIndex);
  }

  const lastColon = address.lastIndexOf(":");
  const tail = lastColon === -1 ? address : address.slice(lastColon + 1);
  if (tail.includes(".")) {
    const ipv4Value = ipv4ToNumber(tail);
    if (ipv4Value === null) {
      return null;
    }
    const high = Math.floor(ipv4Value / 0x1_00_00);
    const low = ipv4Value % 0x1_00_00;
    address = `${address.slice(0, lastColon + 1)}${high.toString(16)}:${low.toString(16)}`;
  }

  const parts = address.split("::");
  if (parts.length > 2) {
    return null;
  }

  let hextetStrings: string[];
  if (parts.length === 2) {
    const headPart = parts[0] ?? "";
    const trailPart = parts[1] ?? "";
    const head = headPart === "" ? [] : headPart.split(":");
    const trail = trailPart === "" ? [] : trailPart.split(":");
    const fill = 8 - head.length - trail.length;
    if (fill < 0) {
      return null;
    }
    hextetStrings = [...head, ...new Array(fill).fill("0"), ...trail];
  } else {
    hextetStrings = address.split(":");
  }

  if (hextetStrings.length !== 8) {
    return null;
  }

  const hextets: number[] = [];
  for (const part of hextetStrings) {
    if (!HEXTET_REGEX.test(part)) {
      return null;
    }
    hextets.push(Number.parseInt(part, 16));
  }

  if (
    hextets[0] === undefined ||
    hextets[1] === undefined ||
    hextets[2] === undefined ||
    hextets[3] === undefined ||
    hextets[4] === undefined ||
    hextets[5] === undefined ||
    hextets[6] === undefined ||
    hextets[7] === undefined
  ) {
    return null;
  }

  return [
    hextets[0],
    hextets[1],
    hextets[2],
    hextets[3],
    hextets[4],
    hextets[5],
    hextets[6],
    hextets[7],
  ];
}

function hextetsToIpv4(high: number, low: number): string {
  const value = high * 0x1_00_00 + low;
  const a = Math.floor(value / 0x1_00_00_00) % 256;
  const b = Math.floor(value / 0x1_00_00) % 256;
  const c = Math.floor(value / 0x1_00) % 256;
  const d = value % 256;
  return `${a}.${b}.${c}.${d}`;
}

function isPrivateOrReservedIpv6(ip: string): boolean {
  const hextets = expandIpv6Hextets(ip);
  if (hextets === null) {
    return true;
  }

  const [h0, h1, h2, h3, h4, h5, h6, h7] = hextets;

  const hasZeroPrefix =
    h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0;
  if (hasZeroPrefix && (h5 === 0xff_ff || h5 === 0)) {
    return isPrivateOrReservedIpv4(hextetsToIpv4(h6, h7));
  }

  // biome-ignore lint/suspicious/noBitwiseOperators: bitmask range checks
  if ((h0 & 0xff_c0) === 0xfe_80) {
    return true;
  }
  // biome-ignore lint/suspicious/noBitwiseOperators: bitmask range checks
  if ((h0 & 0xfe_00) === 0xfc_00) {
    return true;
  }
  // biome-ignore lint/suspicious/noBitwiseOperators: bitmask range checks
  if ((h0 & 0xff_00) === 0xff_00) {
    return true;
  }

  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(normalized)) {
    return true;
  }

  return BLOCKED_HOSTNAME_SUFFIXES.some((suffix) =>
    normalized.endsWith(suffix)
  );
}

function assertPublicIp(address: string, family: number): void {
  const isPrivate =
    (family === 4 && isPrivateOrReservedIpv4(address)) ||
    (family === 6 && isPrivateOrReservedIpv6(address));
  if (isPrivate) {
    throw new PublicUrlValidationError(
      "Private or reserved IP addresses are not allowed"
    );
  }
}

export function assertPublicHttpUrl(raw: string): void {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new PublicUrlValidationError("Invalid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new PublicUrlValidationError("Only http and https URLs are allowed");
  }

  if (parsed.username || parsed.password) {
    throw new PublicUrlValidationError("URL userinfo is not allowed");
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");

  if (!hostname) {
    throw new PublicUrlValidationError("URL must include a hostname");
  }

  const ipVersion = isIP(hostname);
  if (ipVersion) {
    assertPublicIp(hostname, ipVersion);
    return;
  }

  if (isBlockedHostname(hostname)) {
    throw new PublicUrlValidationError(
      "Internal or metadata hostnames are not allowed"
    );
  }
}

export async function resolvePublicHttpUrl(
  raw: string
): Promise<LookupAddress[]> {
  assertPublicHttpUrl(raw);

  const parsed = new URL(raw);
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  const ipVersion = isIP(hostname);
  if (ipVersion) {
    return [{ address: hostname, family: ipVersion }];
  }

  let addresses: LookupAddress[];
  try {
    addresses = await lookup(hostname, { all: true, verbatim: false });
  } catch {
    throw new PublicUrlValidationError("URL hostname could not be resolved");
  }

  if (addresses.length === 0) {
    throw new PublicUrlValidationError("URL hostname could not be resolved");
  }

  for (const { address, family } of addresses) {
    assertPublicIp(address, family);
  }

  return addresses;
}

export async function assertPublicHttpUrlResolution(
  raw: string
): Promise<void> {
  await resolvePublicHttpUrl(raw);
}
