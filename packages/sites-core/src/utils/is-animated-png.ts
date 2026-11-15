/** APNG declares acTL before pixel data; metadata can precede it at any size. */
export function isAnimatedPng(bytes: Uint8Array): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  while (offset + 12 <= bytes.byteLength) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (length > bytes.byteLength - offset - 12) {
      return false;
    }
    if (type === "acTL") {
      return true;
    }
    if (type === "IDAT" || type === "IEND") {
      return false;
    }
    offset += length + 12;
  }
  return false;
}
