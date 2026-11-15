/** Use ordinary URI encoding, with a tagged JSON fallback for lone surrogates. */
export function encodeChatStreamId(id: string): string {
  try {
    return encodeURIComponent(id).replace(/^~/, "%7E");
  } catch {
    return `~${encodeURIComponent(JSON.stringify(id))}`;
  }
}

export function decodeChatStreamId(header: string): string {
  if (!header.startsWith("~")) {
    return decodeURIComponent(header);
  }
  const id: unknown = JSON.parse(decodeURIComponent(header.slice(1)));
  if (typeof id !== "string") {
    throw new URIError("Invalid stream ID encoding");
  }
  return id;
}
