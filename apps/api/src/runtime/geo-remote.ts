import {
  internalGeoSequenceRunResponseSchema,
  internalGeoWriterPlanResponseSchema,
} from "@notra/schemas/api/internal-geo";
import type { z } from "zod";

import {
  GEO_SEQUENCE_RUN_INTERNAL_PATH,
  GEO_WRITER_PLAN_INTERNAL_PATH,
} from "../constants/geo";
import type { RemoteGeoOperation } from "../types/geo";

export const GEO_REMOTE_WRITER_PLAN: RemoteGeoOperation<
  z.infer<typeof internalGeoWriterPlanResponseSchema>
> = {
  label: "writerPlan",
  path: GEO_WRITER_PLAN_INTERNAL_PATH,
  responseSchema: internalGeoWriterPlanResponseSchema,
  timeoutMessage:
    "Brief planning is taking longer than expected and is still in progress. Do not retry. List the project's GEO briefs to find the result.",
  unavailableMessage: "Brief planning is unavailable",
};

export const GEO_REMOTE_SEQUENCE_RUN: RemoteGeoOperation<
  z.infer<typeof internalGeoSequenceRunResponseSchema>
> = {
  label: "sequenceRun",
  path: GEO_SEQUENCE_RUN_INTERNAL_PATH,
  responseSchema: internalGeoSequenceRunResponseSchema,
  timeoutMessage:
    "The sequence run is taking longer than expected and is still in progress. Do not retry. Check the project's GEO checks for the result.",
  unavailableMessage: "Sequence runs are unavailable",
};
