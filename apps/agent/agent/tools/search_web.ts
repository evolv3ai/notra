import { createSearchWebTool } from "@notra/tools/assistant/search-web";

import { withToolActivityLabel } from "../lib/utils/tool-activity";

export default withToolActivityLabel(
  createSearchWebTool(),
  "Searching the web"
);
