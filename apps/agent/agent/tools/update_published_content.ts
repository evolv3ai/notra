import { createUpdatePublishedContentTool } from "@notra/tools/assistant/update-published-content";

import { withToolActivityLabel } from "../lib/utils/tool-activity";

export default withToolActivityLabel(
  createUpdatePublishedContentTool(),
  "Updating the content pull request"
);
