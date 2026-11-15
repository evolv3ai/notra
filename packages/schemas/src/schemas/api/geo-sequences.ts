import "zod/compile";
import { z } from "@hono/zod-openapi";
import { GEO_SEQUENCE_MAX_TURNS } from "@notra/geo-core/constants/geo";

import { organizationResponseSchema } from "./content";
import { createGeoShortTextSchema, geoPromptTextSchema } from "./geo-fields";

const sequenceSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    steps: z.array(z.string()),
    enabled: z.boolean(),
    createdAt: z.string(),
  })
  .openapi("GeoSequence");

const sequenceStepsSchema = z
  .array(geoPromptTextSchema)
  .min(1)
  .max(GEO_SEQUENCE_MAX_TURNS);

export const listSequencesResponseSchema = z
  .object({
    sequences: z.array(sequenceSchema),
    organization: organizationResponseSchema,
  })
  .openapi("ListGeoSequencesResponse");

export const sequenceResponseSchema = z
  .object({
    sequence: sequenceSchema,
    organization: organizationResponseSchema,
  })
  .openapi("GeoSequenceResponse");

export const createSequenceRequestSchema = z
  .object({
    name: createGeoShortTextSchema(),
    steps: sequenceStepsSchema,
  })
  .openapi("CreateGeoSequenceRequest");

export const patchSequenceRequestSchema = z
  .object({
    name: createGeoShortTextSchema().optional(),
    steps: sequenceStepsSchema.optional(),
    enabled: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.steps !== undefined ||
      value.enabled !== undefined,
    { message: "Provide at least one field to update" }
  )
  .openapi("PatchGeoSequenceRequest");

export const deleteSequenceResponseSchema = z
  .object({
    id: z.string(),
    organization: organizationResponseSchema,
  })
  .openapi("DeleteGeoSequenceResponse");

export const runSequenceResponseSchema = z
  .object({
    checks: z.number().int().openapi({
      description:
        "Answers recorded during this request by the API-based engines that responded. Consumer-app answers from the queued scan are not counted.",
    }),
    mentions: z.number().int().openapi({
      description: "How many of those answers mentioned the tracked brand.",
    }),
    engines: z.array(z.string()).openapi({
      description:
        "API-based engines that answered the conversation during this request. Empty when only consumer apps run or none of the API engines answered.",
    }),
    // Defaults keep a dashboard that predates these fields parseable while
    // both sides deploy.
    queuedScanId: z.string().nullable().default(null).openapi({
      description:
        "Scan that plays the conversation in the tracked consumer apps (ChatGPT, Perplexity, Gemini, AI Mode, Copilot) in the background, or `null` when none was queued. Poll `GET /v1/projects/{projectId}/geo/scans/{scanId}` until `status` leaves `running`; its answers then land in the project's GEO checks.",
    }),
    queuedEngines: z.array(z.string()).default([]).openapi({
      description:
        "Consumer-app engines covered by `queuedScanId`. Empty when nothing was queued.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("RunGeoSequenceResponse");
