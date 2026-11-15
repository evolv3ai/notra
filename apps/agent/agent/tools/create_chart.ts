import { defineDynamic } from "eve";
import { defineTool } from "eve/tools";

import { chartInputSchema } from "../lib/schemas/chart";

export default defineDynamic({
  events: {
    "turn.started": (_event, ctx) => {
      const auth = ctx.session.auth.current ?? ctx.session.auth.initiator;
      if (
        auth?.authenticator !== "slack-webhook" &&
        auth?.authenticator !== "notra-dashboard-relay"
      ) {
        return null;
      }
      return defineTool({
        description:
          "Create a line or bar chart in the current Slack thread from verified tool results or data explicitly supplied by the user. Read the data first. Include its source, date range, and units. Use null for missing values, never invent points or turn missing data into zero. At most 120 labels and 6 series; aggregate transparently or request a shorter range for larger data sets.",
        inputSchema: chartInputSchema,
        execute: (input) => input,
        toModelOutput: (output) => ({
          type: "text",
          value: `Chart prepared: ${output.title}. The Slack channel handles image delivery and reports upload failures. Do not claim the image was uploaded; give only a brief data insight if useful.`,
        }),
      });
    },
  },
});
