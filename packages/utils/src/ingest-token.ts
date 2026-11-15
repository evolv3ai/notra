import { createHmac, timingSafeEqual } from "node:crypto";

import type {
  IngestTokenIdentity,
  VerifyIngestTokenInput,
} from "./types/ingest-token";

const SEPARATOR = ".";
const GENERATION_SEGMENT_REGEX = /^g\d+$/;

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyIngestToken({
  secret,
  prefix,
  token,
}: VerifyIngestTokenInput): IngestTokenIdentity | null {
  if (!token.startsWith(prefix)) {
    return null;
  }

  const body = token.slice(prefix.length);
  const separatorIndex = body.lastIndexOf(SEPARATOR);
  if (separatorIndex <= 0) {
    return null;
  }

  const payload = body.slice(0, separatorIndex);
  const signature = body.slice(separatorIndex + 1);
  const expected = sign(payload, secret);
  if (signature.length !== expected.length) {
    return null;
  }

  const matches = timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
  if (!matches) {
    return null;
  }

  const segments = payload.split(SEPARATOR);
  let generation = 1;
  const last = segments.at(-1);
  if (segments.length > 1 && last && GENERATION_SEGMENT_REGEX.test(last)) {
    generation = Number.parseInt(last.slice(1), 10);
    segments.pop();
  }

  const [organizationId, projectId] = segments;
  if (!organizationId) {
    return null;
  }

  return { organizationId, projectId: projectId || null, generation };
}
