import { DEV_HOSTNAMES } from "../constants/cli";

export function isLocalDevHost(host: string | undefined): boolean {
  try {
    const url = new URL(`http://${host ?? ""}`);
    return (
      DEV_HOSTNAMES.has(url.hostname) &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}
