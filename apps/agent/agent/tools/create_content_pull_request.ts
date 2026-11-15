import { createCreateContentPullRequestTool } from "@notra/tools/assistant/create-content-pull-request";

import { withToolActivityLabel } from "../lib/utils/tool-activity";

export default withToolActivityLabel(
  createCreateContentPullRequestTool(),
  "Preparing a content draft pull request"
);
