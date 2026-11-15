import { createGetCommitsByTimeframeTool } from "@notra/tools/assistant/get-commits-by-timeframe";

import { withToolActivityLabel } from "../lib/utils/tool-activity";

export default withToolActivityLabel(
  createGetCommitsByTimeframeTool(),
  "Reading GitHub commits"
);
