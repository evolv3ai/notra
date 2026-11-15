import { fetchPublicUrl } from "@notra/ai/utils/public-fetch";

import { GEO_SITE_TEXT_MAX } from "@/constants/geo-report";

export async function fetchSiteText(domain: string) {
  try {
    const response = await fetchPublicUrl(
      `https://${domain}`,
      {
        headers: { "User-Agent": "NotraGeoReport/1.0" },
      },
      { maxRedirects: 3, timeoutMs: 10_000 }
    );
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      return "";
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let html = "";
    let remaining = 256_000;
    try {
      while (remaining > 0) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        html += decoder.decode(value.subarray(0, remaining), { stream: true });
        remaining -= value.byteLength;
      }
      html += decoder.decode();
    } finally {
      await reader.cancel().catch(() => undefined);
    }
    return html
      .replace(
        // Unterminated blocks end at EOF and tags stop at the next "<", so
        // malformed pages can't make each "<" rescan the rest of the body.
        /<script(?=[\s/>])[\s\S]*?(?:<\/script>|$)|<style(?=[\s/>])[\s\S]*?(?:<\/style>|$)|<[^<>]+>/g,
        " "
      )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, GEO_SITE_TEXT_MAX);
  } catch {
    return "";
  }
}
