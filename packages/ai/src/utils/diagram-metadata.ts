import { diagramSpecSchema } from "@notra/ai/schemas/excalidraw-diagram";
import type { DiagramSpec } from "@notra/ai/types/excalidraw-diagram";
import type { RepoImageFormat } from "@notra/ai/types/repo-image";
import { isRecord, readNumber, readString } from "@notra/utils/unknown-record";

/** The editable spec saved on a diagram post, or null for other images. */
export function readDiagramSpec(metadata: unknown): DiagramSpec | null {
  if (!isRecord(metadata)) {
    return null;
  }
  const parsed = diagramSpecSchema.safeParse(metadata.diagramSpec);
  return parsed.success ? parsed.data : null;
}

export function readExcalidrawUrl(metadata: unknown) {
  return isRecord(metadata) ? readString(metadata, "excalidrawUrl") : undefined;
}

export function readImageFormat(metadata: unknown): RepoImageFormat {
  const isDiagram =
    isRecord(metadata) &&
    (metadata.format === "diagram" || Boolean(metadata.diagramSpec));
  return isDiagram ? "diagram" : "marketing";
}

export function readDiagramRevision(metadata: unknown) {
  return (isRecord(metadata) && readNumber(metadata, "diagramRevision")) || 0;
}

export function canEditDiagramWithoutSandbox(metadata: unknown) {
  return readDiagramSpec(metadata) !== null;
}
