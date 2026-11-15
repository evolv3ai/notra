import { readFile, writeFile } from "node:fs/promises";

import { Effect } from "effect";

import { askGeoContextAnswer } from "../../../src/geo/context";
import { reportContextCheckpointSchema } from "../schemas/collection";

/** Reuse the shared DOM capture adapter without resubmitting ambiguous requests. */
export async function askReportContext(
  engine: string,
  prompt: string,
  checkpoint: string
) {
  try {
    const saved = reportContextCheckpointSchema.parse(
      JSON.parse(await readFile(checkpoint, "utf8"))
    );
    if (saved.engine !== engine || saved.prompt !== prompt) {
      throw new Error(
        `Context checkpoint belongs to a different request: ${checkpoint}`
      );
    }
    if (!saved.answer) {
      throw new Error(`Review ambiguous Context submission: ${checkpoint}`);
    }
    return saved.answer;
  } catch (error) {
    if (
      !(error instanceof Error && "code" in error && error.code === "ENOENT")
    ) {
      throw error;
    }
  }
  await writeFile(checkpoint, JSON.stringify({ engine, prompt }), {
    flag: "wx",
  });
  const captured = await Effect.runPromise(
    askGeoContextAnswer(engine, prompt, "en")
  );
  const answer = {
    text: captured.text,
    sources: captured.grounding.sources,
    searchQueries: captured.grounding.queries,
    present: !captured.absent,
    overview: null,
    providerMetadata: captured.grounding.capture,
  };
  await writeFile(checkpoint, JSON.stringify({ engine, prompt, answer }));
  return answer;
}
