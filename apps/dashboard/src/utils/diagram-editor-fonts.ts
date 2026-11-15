import { DIAGRAM_EDITOR_FONT_TIMEOUT_MS } from "@/constants/diagram-editor";

export async function waitForDiagramFonts() {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      document.fonts.ready,
      new Promise<void>((resolve) => {
        timeout = setTimeout(resolve, DIAGRAM_EDITOR_FONT_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}
