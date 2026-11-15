export function acceptsGzip(header: string | undefined): boolean {
  if (!header) {
    return false;
  }
  const qualities = new Map<string, number>();
  for (const entry of header.split(",")) {
    const [encoding, ...parameters] = entry.trim().toLowerCase().split(";");
    if (!encoding) {
      continue;
    }
    let quality = 1;
    for (const parameter of parameters) {
      const [name, value] = parameter.trim().split("=");
      if (name === "q") {
        quality = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(value ?? "")
          ? Number(value)
          : 0;
      }
    }
    qualities.set(encoding, Math.min(qualities.get(encoding) ?? 1, quality));
  }
  const gzipQuality = qualities.get("gzip") ?? qualities.get("*") ?? 0;
  return gzipQuality > 0 && gzipQuality >= (qualities.get("identity") ?? 0);
}
