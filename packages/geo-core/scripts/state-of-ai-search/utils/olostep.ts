import { readFile, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

import { Effect } from "effect";

import {
  askGeoOlostepAnswer,
  collectGeoOlostepResults,
  submitGeoOlostepBatches,
} from "../../../src/geo/olostep";
import {
  OLOSTEP_REPORT_POLL_MS,
  OLOSTEP_REPORT_WAIT_MS,
} from "../constants/collection";
import { reportOlostepCheckpointSchema } from "../schemas/collection";

/** Persist before sending: an interrupted/ambiguous POST must not be resubmitted. */
export async function submitReportOlostep(
  engine: string,
  prompt: string,
  checkpoint: string
) {
  let batchId: string | undefined;
  try {
    const saved = reportOlostepCheckpointSchema.parse(
      JSON.parse(await readFile(checkpoint, "utf8"))
    );
    if (saved.engine !== engine || saved.prompt !== prompt) {
      throw new Error(
        `Olostep checkpoint belongs to a different request: ${checkpoint}`
      );
    }
    batchId = saved.batchId;
    if (!batchId) {
      throw new Error(`Review ambiguous Olostep submission: ${checkpoint}`);
    }
  } catch (error) {
    if (
      !(error instanceof Error && "code" in error && error.code === "ENOENT")
    ) {
      throw error;
    }
    await writeFile(checkpoint, JSON.stringify({ engine, prompt }), {
      flag: "wx",
    });
    const ids = await Effect.runPromise(
      submitGeoOlostepBatches([{ engine, language: "en", text: prompt }], [0])
    );
    batchId = ids[0];
    if (!batchId) {
      throw new Error(
        `Olostep submission failed; review ${checkpoint} before retrying`
      );
    }
    await writeFile(checkpoint, JSON.stringify({ engine, prompt, batchId }));
  }
  return batchId;
}

/** Poll one checkpointed batch at a time; its item id stays local to this batch. */
export async function askReportOlostep(
  engine: string,
  prompt: string,
  checkpoint: string
) {
  const batchId = await submitReportOlostep(engine, prompt, checkpoint);
  const deadline = Date.now() + OLOSTEP_REPORT_WAIT_MS;
  while (Date.now() < deadline) {
    const results = await Effect.runPromise(
      collectGeoOlostepResults([batchId])
    );
    if (results["0"]) {
      const answer = await Effect.runPromise(
        askGeoOlostepAnswer(engine, results["0"])
      );
      if (!answer.text && !(engine === "google/ai-overview" && answer.absent)) {
        throw new Error(`Olostep returned no answer for ${engine}`);
      }
      return {
        text: answer.text,
        sources: answer.grounding.sources,
        searchQueries: answer.grounding.queries,
        present: !answer.absent,
        overview: null,
        providerMetadata: {
          provider: "olostep",
          batchId,
          retrieveId: results["0"],
        },
      };
    }
    await sleep(OLOSTEP_REPORT_POLL_MS);
  }
  throw new Error(`Olostep timed out; batch ${batchId} is saved for resume`);
}
