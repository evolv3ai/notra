import { createGetLinearIssuesTool } from "@notra/tools/assistant/get-linear-issues";

import { withToolActivityLabel } from "../../../lib/utils/tool-activity";

export default withToolActivityLabel(
  createGetLinearIssuesTool(),
  "Reading Linear issues"
);
