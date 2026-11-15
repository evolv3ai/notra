import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

import { pack } from "tar-stream";

import type { ArchiveFile } from "../types/tar";

export async function writeTarGz(
  files: ArchiveFile[],
  directory: string
): Promise<Uint8Array<ArrayBuffer>> {
  const archive = pack();
  const result = pipeline(archive, createGzip(), async (source) => {
    const chunks: Buffer[] = [];
    for await (const chunk of source) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  });
  archive.entry({
    name: directory,
    type: "directory",
    mode: 0o755,
    mtime: new Date(0),
  });
  for (const file of files) {
    archive.entry(
      { name: file.path, mode: 0o644, mtime: new Date(0) },
      Buffer.from(file.data.buffer, file.data.byteOffset, file.data.byteLength)
    );
  }
  archive.finalize();
  return await result;
}
