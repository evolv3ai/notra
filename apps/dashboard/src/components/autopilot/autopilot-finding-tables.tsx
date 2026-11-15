"use client";

import { AutopilotPullRequestsTable } from "@/components/autopilot/autopilot-pull-requests-table";
import type { AutopilotFindingTablesProps } from "@/types/autopilot";
import { isIdeaFinding, isListedPullRequest } from "@/utils/autopilot-findings";

/** Pull requests, then the open ideas below them when there are any. */
export function AutopilotFindingTables({
  findings,
  idPrefix,
  ...tableProps
}: AutopilotFindingTablesProps) {
  const ideas = findings.filter(isIdeaFinding);
  return (
    <div className="space-y-8">
      <section
        aria-labelledby={`${idPrefix}-pull-requests`}
        className="space-y-3"
      >
        <h2
          className="px-1 text-sm font-medium"
          id={`${idPrefix}-pull-requests`}
        >
          Pull requests
        </h2>
        <AutopilotPullRequestsTable
          findings={findings.filter(isListedPullRequest)}
          {...tableProps}
        />
      </section>
      {ideas.length > 0 ? (
        <section aria-labelledby={`${idPrefix}-ideas`} className="space-y-3">
          <h2 className="px-1 text-sm font-medium" id={`${idPrefix}-ideas`}>
            Open ideas
          </h2>
          <AutopilotPullRequestsTable
            findings={ideas}
            view="ideas"
            {...tableProps}
          />
        </section>
      ) : null}
    </div>
  );
}
