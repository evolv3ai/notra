import { createReviseImageTool } from "@notra/tools/image/revise-image";

import { withToolActivityLabel } from "../../../lib/utils/tool-activity";

export default withToolActivityLabel(
  createReviseImageTool(),
  "Revising a content image"
);
