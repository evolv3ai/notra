import { createGetGranolaNoteTool } from "@notra/tools/assistant/get-granola-note";

import { withToolActivityLabel } from "../lib/utils/tool-activity";

export default withToolActivityLabel(
  createGetGranolaNoteTool(),
  "Reading a Granola meeting"
);
