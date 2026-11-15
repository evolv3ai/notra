import { createWriterCreatePostTool } from "@notra/tools/content-writer/create-post";

import { withToolActivityLabel } from "../../../lib/utils/tool-activity";

export default withToolActivityLabel(
  createWriterCreatePostTool(),
  "Saving the generated content"
);
