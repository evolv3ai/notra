import { createHash } from "node:crypto";

export function githubBlobSha(contents: Uint8Array | string) {
  const body = Buffer.from(contents);
  return createHash("sha1")
    .update(`blob ${body.byteLength}\0`)
    .update(body)
    .digest("hex");
}
