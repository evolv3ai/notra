import { expect, test } from "bun:test";

import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { IntlProvider } from "use-intl";

import type { SiteContextValue, SiteDeployment } from "@/types/sites";

import messages from "../../../messages/en.json";
import { SiteContext } from "./site-context";
import { SiteOverviewStatus } from "./site-overview-status";

test("active builds keep their status and duration without a follow-build action", () => {
  const router = createRouter({
    routeTree: createRootRoute(),
    history: createMemoryHistory(),
  });
  const context = {
    organizationSlug: "org",
    siteId: "site",
  } as SiteContextValue;

  for (const status of [
    "queued",
    "building",
    "uploading",
    "ready",
    "failed",
  ] as const) {
    const inProgress = ["queued", "building", "uploading"].includes(status);
    const deployment = {
      id: "deployment",
      status,
      createdAt: new Date(Date.now() - 60_000),
      startedAt: new Date(Date.now() - 60_000),
    } as SiteDeployment;
    const html = renderToStaticMarkup(
      <IntlProvider locale="en" messages={messages} timeZone="UTC">
        <RouterContextProvider router={router}>
          <SiteContext.Provider value={context}>
            <SiteOverviewStatus deployment={deployment} suspended={false} />
          </SiteContext.Provider>
        </RouterContextProvider>
      </IntlProvider>
    );

    expect(html).not.toContain("Follow build");
    expect(html.includes("View logs")).toBe(!inProgress);
    expect(html).toContain("/org/sites/site/deployments/deployment");
    expect(html).toContain(
      messages.sites.status[status === "uploading" ? "building" : status]
    );
    if (inProgress) {
      expect(html).toContain("tabular-nums");
      expect(html).not.toContain("group-hover:translate-x-0.5");
    }
  }
});
