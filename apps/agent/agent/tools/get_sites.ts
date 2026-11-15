import { createGetSitesTool } from "@notra/tools/assistant/get-sites";

import type { PublicSitesTool } from "../lib/types/sites";
import { withToolActivityLabel } from "../lib/utils/tool-activity";

const tool: PublicSitesTool = withToolActivityLabel(
  createGetSitesTool(),
  "Finding public sites"
);

export default tool;
