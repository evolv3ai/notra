import { createGetPullRequestsTool } from "@notra/tools/assistant/get-pull-requests";

import { withToolActivityLabel } from "../../../lib/utils/tool-activity";

export default withToolActivityLabel(
  createGetPullRequestsTool(),
  "Reading a GitHub pull request"
);
