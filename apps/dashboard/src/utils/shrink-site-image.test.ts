import { expect, mock, test } from "bun:test";
import { crc32, deflateSync } from "node:zlib";

import { shrinkSiteImage } from "./shrink-site-image";

function pngChunk(type: string, data: Buffer) {
  const header = Buffer.alloc(4);
  header.writeUInt32BE(data.length);
  const content = Buffer.concat([Buffer.from(type), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(content));
  return Buffer.concat([header, content, checksum]);
}

test("APNG animation is preserved when metadata precedes the animation chunks", async () => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6;
  const animation = Buffer.alloc(8);
  animation.writeUInt32BE(2);
  const frame = Buffer.alloc(26);
  frame.writeUInt32BE(1, 4);
  frame.writeUInt32BE(1, 8);
  frame.writeUInt16BE(1, 20);
  frame.writeUInt16BE(10, 22);
  const secondFrame = Buffer.from(frame);
  secondFrame.writeUInt32BE(1);
  const sequence = Buffer.alloc(4);
  sequence.writeUInt32BE(2);
  const pixels = deflateSync(Buffer.from([0, 255, 0, 0, 255]));
  const file = new File(
    [
      Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        pngChunk("IHDR", header),
        pngChunk(
          "tEXt",
          Buffer.from(`Comment\0${"x".repeat(3 * 1024 * 1024)}`)
        ),
        pngChunk("acTL", animation),
        pngChunk("fcTL", frame),
        pngChunk("IDAT", pixels),
        pngChunk("fcTL", secondFrame),
        pngChunk("fdAT", Buffer.concat([sequence, pixels])),
        pngChunk("IEND", Buffer.alloc(0)),
      ]),
    ],
    "animated.png",
    { type: "image/png" }
  );
  const original = globalThis.createImageBitmap;
  const decode = mock(() => Promise.reject(new Error("Unexpected decode")));
  globalThis.createImageBitmap = decode;
  try {
    expect(await shrinkSiteImage(file, "background")).toBe(file);
    expect(decode).not.toHaveBeenCalled();
  } finally {
    globalThis.createImageBitmap = original;
  }
});
