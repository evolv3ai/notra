import { qstashRouteUrlCandidates } from "@notra/ai/qstash/triggers";
import { Receiver } from "@upstash/qstash";

export async function verifyQstashSignature(params: {
  request: Request;
  rawBody: string;
  path: string;
}): Promise<boolean> {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!(currentSigningKey && nextSigningKey)) {
    return false;
  }
  const signature = params.request.headers.get("upstash-signature");
  if (!signature) {
    return false;
  }
  const receiver = new Receiver({ currentSigningKey, nextSigningKey });
  for (const url of qstashRouteUrlCandidates(params.path)) {
    try {
      if (await receiver.verify({ signature, body: params.rawBody, url })) {
        return true;
      }
    } catch {
      // Signature or URL mismatch; try the next candidate.
    }
  }
  return false;
}
