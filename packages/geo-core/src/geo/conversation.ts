import { DEFAULT_LANGUAGE } from "@notra/ai/constants/languages";
import type { GeoCheckWrite } from "@notra/db/types/geo-checks";
import type { ModelMessage } from "ai";
import { Effect } from "effect";

import { GEO_EXCERPT_MAX_LENGTH } from "../constants/geo";
import { MAX_JUDGE_COMPETITORS } from "../constants/geo-conversations";
import { GeoModelService } from "../deps";
import type {
  GeoCheckContext,
  GeoEngineAnswer,
  GeoGroundedEngine,
  GeoSkipFields,
  GeoZdrMode,
} from "../types/geo";
import type {
  GeoConversationEngine,
  GeoConversationOutcome,
  GeoConversationSource,
} from "../types/geo-conversations";
import { normalizePosition } from "../utils/geo-check-evaluation";
import { geoContextConversationPrompt } from "../utils/geo-context";
import { geoLogWarn, logGeoSkip } from "../utils/geo-log";
import { geoOlostepPersonaQuery } from "../utils/geo-olostep-plan";
import { hasOwnedSourceCitation } from "../utils/geo-owned-source";
import {
  addAgentTokenUsage,
  agentTokenUsageFrom,
  EMPTY_AGENT_TOKEN_USAGE,
  geoCheckWriteUsage,
} from "../utils/token-usage";
import { judgeAnswer, requireAnswerText } from "./check-evaluation";
import { askGeoContextAnswer } from "./context";
import { GeoScanError } from "./errors";
import { askGeoOlostepAnswer } from "./olostep";

/**
 * Owns the transcript, deadline and partial results for both kinds of
 * conversation. Context builds fresh question-only context; Olostep reads
 * preplanned results. Neither pretends to continue a consumer UI session.
 */
export const runGeoConversation = Effect.fn("geo.runConversation")(function* (
  context: GeoCheckContext,
  source: GeoConversationSource,
  engine: GeoConversationEngine,
  zdr: GeoZdrMode
) {
  const models = yield* GeoModelService;
  const language = source.language ?? DEFAULT_LANGUAGE;
  const rows: GeoCheckWrite[] = [];
  const messages: ModelMessage[] = [];
  let engineUsage = EMPTY_AGENT_TOKEN_USAGE;
  let judgeUsage = EMPTY_AGENT_TOKEN_USAGE;
  const fields: GeoSkipFields = {
    event: "geo.check.failed",
    organizationId: context.organizationId,
    projectId: context.projectId,
    scanId: context.scanId,
    runId: context.runId,
    promptId: source.promptId,
    personaId: source.personaId,
    sequenceId: source.sequenceId,
    engine: engine.key,
    grounded: true,
  };

  const play = Effect.gen(function* () {
    for (const [index, prompt] of source.prompts.entries()) {
      const turnStartedMs = performance.now();
      messages.push({ role: "user", content: prompt });
      const logContext = {
        projectId: context.projectId,
        scanId: context.scanId,
        runId: context.runId,
        promptId: source.promptId,
        turn: index + 1,
      };
      const olostep = "retrieveIds" in engine;
      const olostepRetrieveId = olostep ? engine.retrieveIds[index] : null;
      if (olostep && !olostepRetrieveId) {
        logGeoSkip(
          "olostep turn has no result",
          { ...fields, turn: index + 1 },
          null
        );
        continue;
      }
      let answer: GeoEngineAnswer;
      if (olostep) {
        answer = yield* askGeoOlostepAnswer(engine.key, olostepRetrieveId);
      } else if ("context" in engine) {
        const question = geoContextConversationPrompt(source.prompts, index);
        answer = yield* askGeoContextAnswer(
          engine.key,
          source.snapshot
            ? geoOlostepPersonaQuery(source.snapshot, question)
            : question,
          language
        );
      } else {
        answer = yield* models.groundedAnswer({
          organizationId: context.organizationId,
          engine,
          messages,
          zdr,
          logContext,
        });
      }
      engineUsage = addAgentTokenUsage(
        engineUsage,
        agentTokenUsageFrom(answer.usage)
      );
      if (zdr !== "none" && answer.zdrEnforced === false) {
        yield* geoLogWarn({
          ...fields,
          event: "geo.check.zdr_relaxed",
          turn: index + 1,
          zdr,
        });
      }
      const text = yield* requireAnswerText(
        engine.key,
        source.promptId,
        language,
        answer
      );
      messages.push({ role: "assistant", content: text });
      const judged = yield* judgeAnswer(context, prompt, text, logContext);
      judgeUsage = addAgentTokenUsage(
        judgeUsage,
        agentTokenUsageFrom(judged.usage)
      );
      rows.push({
        organizationId: context.organizationId,
        projectId: context.projectId,
        scanId: context.scanId,
        engine: engine.key,
        promptId: source.promptId,
        sequenceId: source.sequenceId ?? null,
        personaId: source.personaId ?? null,
        personaSnapshot: source.snapshot ?? null,
        turn: index + 1,
        prompt,
        answer: text,
        capturedAt: context.capturedAt,
        mentioned: judged.mentioned,
        ownedSourceCited: hasOwnedSourceCitation(
          context.websiteUrl,
          answer.sources,
          context.domains
        ),
        position: normalizePosition(judged.position),
        sentiment: judged.sentiment,
        competitors: judged.competitors.slice(0, MAX_JUDGE_COMPETITORS),
        excerpt: judged.excerpt.slice(0, GEO_EXCERPT_MAX_LENGTH),
        grounding: answer.grounding,
        finishReason: answer.finishReason,
        ...geoCheckWriteUsage(
          answer.usage,
          judged.usage,
          Math.round(performance.now() - turnStartedMs)
        ),
        zdrEnforced: answer.zdrEnforced,
        language,
        sources: answer.sources,
        surfaces: answer.surfaces ?? null,
      });
    }
  });
  yield* play.pipe(
    Effect.timeoutOrElse({
      duration: source.timeoutMs,
      orElse: () =>
        Effect.fail(
          new GeoScanError({
            message: `Conversation ${source.promptId} on ${engine.key} timed out`,
          })
        ),
    }),
    Effect.catch((error) =>
      Effect.sync(() =>
        logGeoSkip(
          "conversation stopped after a failed turn",
          { ...fields, turn: rows.length + 1 },
          error
        )
      )
    )
  );
  const outcome: GeoConversationOutcome = {
    rows,
    usage: addAgentTokenUsage(engineUsage, judgeUsage),
    engineUsage,
    judgeUsage,
    droppedTurns: source.prompts.length - rows.length,
  };
  return outcome;
});
