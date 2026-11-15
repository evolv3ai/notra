import { createGetLinearProjectsTool } from "@notra/tools/assistant/get-linear-projects";

import { withToolActivityLabel } from "../lib/utils/tool-activity";

export default withToolActivityLabel(
  createGetLinearProjectsTool(),
  "Reading Linear projects"
);
