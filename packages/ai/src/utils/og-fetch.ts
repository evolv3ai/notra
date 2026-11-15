import {
  OG_ASSET_MAX_BYTES,
  OG_FETCH_TIMEOUT_MS,
} from "@notra/ai/constants/og-image";
import type { OgFetchResult } from "@notra/ai/types/og-image";
import { fetchPublicUrl } from "@notra/ai/utils/public-fetch";

/** Reuse the DNS-pinned public fetcher; also bound the decompressed body. */
export async function fetchOgResource(
  rawUrl: string,
  signal?: AbortSignal
): Promise<OgFetchResult> {
  const response = await fetchPublicUrl(
    rawUrl,
    {
      headers: { "user-agent": "Notra-OG/1.0", accept: "*/*" },
      signal,
    },
    { timeoutMs: OG_FETCH_TIMEOUT_MS, maxRedirects: 4 }
  );
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new Error(`OG resource returned HTTP ${response.status}`);
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }
      length += chunk.value.length;
      if (length > OG_ASSET_MAX_BYTES) {
        throw new Error("OG resource exceeds size limit");
      }
      chunks.push(chunk.value);
    }
  } finally {
    await reader.cancel();
  }
  return {
    bytes: Buffer.concat(chunks),
    contentType: response.headers.get("content-type") ?? "",
    url: response.url,
  };
}
