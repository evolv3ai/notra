import { createGetGranolaNotesTool } from "@notra/tools/assistant/get-granola-notes";

import { withToolActivityLabel } from "../lib/utils/tool-activity";

export default withToolActivityLabel(
  createGetGranolaNotesTool(),
  "Reading Granola meeting notes"
);
