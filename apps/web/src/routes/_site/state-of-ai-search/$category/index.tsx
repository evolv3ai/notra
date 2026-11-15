import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

import { latestSummary } from "@/lib/state-of-ai-search/reports";

export const Route = createFileRoute("/_site/state-of-ai-search/$category/")({
  beforeLoad: ({ params }) => {
    const report = latestSummary(params.category);
    if (!report) {
      throw notFound();
    }
    throw redirect({
      to: "/state-of-ai-search/$category/$edition",
      params: { category: report.slug, edition: report.edition },
    });
  },
});
