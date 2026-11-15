import { createUpdatePostTool } from "@notra/tools/assistant/update-post";

import { withToolActivityLabel } from "../lib/utils/tool-activity";

export default withToolActivityLabel(
  createUpdatePostTool(),
  "Updating a content post"
);
