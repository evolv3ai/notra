export function commentSubmitId(
  retry: {
    id: string;
    body: string;
    parentId: string | null;
    anchorKey?: string | null;
  } | null,
  body: string,
  parentId: string | null,
  anchorKey: string | null = null
) {
  return retry?.body === body &&
    retry.parentId === parentId &&
    (retry.anchorKey ?? null) === anchorKey
    ? retry.id
    : crypto.randomUUID();
}
