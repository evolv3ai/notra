import { createCreatePostTool } from "@notra/tools/assistant/create-post";

import { withToolActivityLabel } from "../lib/utils/tool-activity";

export default withToolActivityLabel(
  createCreatePostTool("blog_post"),
  "Saving a blog post draft"
);
