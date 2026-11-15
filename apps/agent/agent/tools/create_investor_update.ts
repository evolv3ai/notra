import { createCreatePostTool } from "@notra/tools/assistant/create-post";

import { withToolActivityLabel } from "../lib/utils/tool-activity";

export default withToolActivityLabel(
  createCreatePostTool("investor_update"),
  "Saving a investor update draft"
);
