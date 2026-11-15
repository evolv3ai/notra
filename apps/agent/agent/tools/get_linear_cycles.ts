import { createGetLinearCyclesTool } from "@notra/tools/assistant/get-linear-cycles";

import { withToolActivityLabel } from "../lib/utils/tool-activity";

export default withToolActivityLabel(
  createGetLinearCyclesTool(),
  "Reading Linear cycles"
);
