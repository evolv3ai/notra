import { Data } from "effect";

import type { GeoCodingAgentAccessServiceShape } from "./deps";

export class GeoCodingAgentAccessCacheKey extends Data.Class<{
  readonly organizationId: string;
  readonly access: GeoCodingAgentAccessServiceShape;
}> {}
