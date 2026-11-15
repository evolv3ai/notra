import { createPreviewContentTool } from "@notra/tools/assistant/preview-content";

import { withToolActivityLabel } from "../lib/utils/tool-activity";

export default withToolActivityLabel(
  createPreviewContentTool(),
  "Checking content previews"
);
