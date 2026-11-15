import { createGenerateImageTool } from "@notra/tools/image/generate-image";

import { withToolActivityLabel } from "../../../lib/utils/tool-activity";

export default withToolActivityLabel(
  createGenerateImageTool(),
  "Generating a content image"
);
