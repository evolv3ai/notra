import { isRecord } from "@notra/utils/unknown-record";

export function readOfferingSearchOutput(output: unknown) {
  if (!isRecord(output)) {
    return { queries: [], urls: [] };
  }
  const action = isRecord(output.action) ? output.action : {};
  const listed = Array.isArray(action.queries)
    ? action.queries
    : [action.query];
  const queries = listed.flatMap((query) =>
    typeof query === "string" && query.trim().length > 0 ? [query.trim()] : []
  );
  const urls = (Array.isArray(output.sources) ? output.sources : []).flatMap(
    (source) =>
      isRecord(source) && typeof source.url === "string" ? [source.url] : []
  );
  return { queries, urls };
}
