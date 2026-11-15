import { Badge } from "@notra/ui/components/ui/badge";

import type { AutopilotTraceFindingsProps } from "@/types/autopilot";
import { autopilotGitHubUrl } from "@/utils/autopilot";

export function AutopilotTraceFindings({
  findings,
}: AutopilotTraceFindingsProps) {
  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-semibold">Findings</h2>
      {findings.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No findings recorded for this run.
        </p>
      ) : null}
      {findings.map((finding) => {
        const url = autopilotGitHubUrl(finding.pullRequestUrl);
        return (
          <article key={finding.id} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium">{finding.title}</h3>
              <Badge variant="secondary">{finding.status}</Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              {finding.summary}
            </p>
            {finding.errorMessage ? (
              <p className="mt-2 text-sm">{finding.errorMessage}</p>
            ) : null}
            {url ? (
              <a
                className="mt-2 inline-block text-sm underline underline-offset-4"
                href={url}
                target="_blank"
                rel="noreferrer"
              >
                Review draft on GitHub
              </a>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
