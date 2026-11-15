import type { SiteEditorDraft } from "@/types/sites";

export function siteDraftVersion(
  drafts: readonly Pick<SiteEditorDraft, "id" | "revision">[]
): string {
  return drafts
    .map((draft) => `${draft.id}:${draft.revision}`)
    .sort()
    .join(",");
}
