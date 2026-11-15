import { createGetReleaseByTagTool } from "@notra/tools/assistant/get-release-by-tag";

import { withToolActivityLabel } from "../lib/utils/tool-activity";

export default withToolActivityLabel(
  createGetReleaseByTagTool(),
  "Reading GitHub release notes"
);
