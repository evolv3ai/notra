import { createGetSiteContentTool } from "@notra/tools/assistant/get-site-content";

import type { PublicSiteContentTool } from "../lib/types/sites";
import { withToolActivityLabel } from "../lib/utils/tool-activity";

const tool: PublicSiteContentTool = withToolActivityLabel(
  createGetSiteContentTool(),
  "Reading published site content"
);

export default tool;
