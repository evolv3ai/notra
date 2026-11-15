import { createCreatePostTool } from "@notra/tools/assistant/create-post";

import { withToolActivityLabel } from "../lib/utils/tool-activity";

export default withToolActivityLabel(
  createCreatePostTool("linkedin_post"),
  "Saving a linkedin post draft"
);
