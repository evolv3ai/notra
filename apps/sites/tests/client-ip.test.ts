import { describe, expect, test } from "bun:test";

import { forwardedClientIp, isPublicIp } from "../src/utils/client-ip";

describe("isPublicIp", () => {
  test("internal, loopback and malformed addresses aren't visitors", () => {
    for (const ip of [
      "10.1.2.3",
      "127.0.0.1",
      "100.64.0.12",
      "100.127.255.1",
      "169.254.1.1",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "0.0.0.0",
      "256.1.1.1",
      "::",
      "::1",
      "fc00::1",
      "fd12:3456::1",
      "FE80::1",
      "febf::1",
      "::ffff:10.0.0.1",
      "::ffff:a00:1",
      "0:0:0:0:0:0:0:1",
      "0:0:0:0:0:0:0:0",
      "fc00:0:0:0:0:0:0:1",
      "a:b",
      "1:2:3:4:5:6:7:8:9",
      "1::2::3",
      "12345::1",
      "::ffff:1.2.3.256",
      "unknown",
      "[2001:db8::1]:443",
      "1.2.3",
    ]) {
      expect(isPublicIp(ip)).toBe(false);
    }
  });

  test("public addresses are", () => {
    for (const ip of [
      "203.0.113.9",
      "100.63.0.1",
      "100.128.0.1",
      "172.15.0.1",
      "172.32.0.1",
      "2001:db8::1",
      "2a06:98c0:3600::103",
      "::ffff:203.0.113.9",
      "::ffff:cb00:7109",
      "2001:DB8:0:0:0:0:0:1",
      "fec0::1",
    ]) {
      expect(isPublicIp(ip)).toBe(true);
    }
  });
});

describe("forwardedClientIp", () => {
  test("takes the address the proxy wrote, not what the visitor sent", () => {
    expect(forwardedClientIp("198.51.100.7, 192.0.2.10", "192.0.2.10")).toBe(
      "198.51.100.7"
    );
    expect(
      forwardedClientIp("1.1.1.1, 198.51.100.7, 192.0.2.10", "192.0.2.10")
    ).toBe("198.51.100.7");
    expect(
      forwardedClientIp("198.51.100.7, 100.64.0.12,10.0.0.3", "192.0.2.10")
    ).toBe("198.51.100.7");
  });

  test("a request nobody forwarded has no forwarded visitor", () => {
    expect(forwardedClientIp("198.51.100.7", "198.51.100.7")).toBeUndefined();
    expect(forwardedClientIp(null, "198.51.100.7")).toBeUndefined();
    expect(forwardedClientIp(" , ", undefined)).toBeUndefined();
    expect(
      forwardedClientIp("10.0.0.3, 192.0.2.10", "192.0.2.10")
    ).toBeUndefined();
  });
});
