import { createGetGranolaFoldersTool } from "@notra/tools/assistant/get-granola-folders";

import { withToolActivityLabel } from "../lib/utils/tool-activity";

export default withToolActivityLabel(
  createGetGranolaFoldersTool(),
  "Reading Granola folders"
);
