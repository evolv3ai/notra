import { createFetchWebpageTool } from "@notra/tools/assistant/fetch-webpage";

import { withToolActivityLabel } from "../lib/utils/tool-activity";

export default withToolActivityLabel(
  createFetchWebpageTool(),
  "Reading a webpage"
);
