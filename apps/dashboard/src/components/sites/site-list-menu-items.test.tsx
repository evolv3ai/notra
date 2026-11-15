import { expect, test } from "bun:test";

import { ContextMenu } from "@notra/ui/components/ui/context-menu";
import { DropdownMenu } from "@notra/ui/components/ui/dropdown-menu";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { IntlProvider } from "use-intl";

import type { SiteListItem } from "@/types/sites";

import messages from "../../../messages/en.json";
import { SiteListMenuItems } from "./site-list-menu-items";

test("both site menus disable redeploy while pending, suspended, or without a finished deployment", () => {
  const router = createRouter({
    routeTree: createRootRoute(),
    history: createMemoryHistory(),
  });

  for (const variant of ["context", "dropdown"] as const) {
    const Menu = variant === "context" ? ContextMenu : DropdownMenu;
    for (const [status, deploymentStatus, pending, disabled] of [
      ["active", "ready", false, false],
      ["active", "failed", false, false],
      ["active", "ready", true, true],
      ["suspended", "ready", false, true],
      ["active", null, false, true],
      ["active", "queued", false, true],
      ["active", "building", false, true],
      ["active", "uploading", false, true],
    ] as const) {
      const site = {
        id: "site",
        projectId: "project",
        liveUrl: "https://example.com",
        status,
        latestDeployment: deploymentStatus
          ? { id: "deployment", status: deploymentStatus }
          : null,
      } as SiteListItem;
      const html = renderToStaticMarkup(
        <IntlProvider locale="en" messages={messages} timeZone="UTC">
          <RouterContextProvider router={router}>
            <Menu>
              <SiteListMenuItems
                organizationSlug="org"
                site={site}
                onDelete={() => {}}
                onRedeploy={() => {}}
                redeployPending={pending}
                variant={variant}
              />
            </Menu>
          </RouterContextProvider>
        </IntlProvider>
      );
      const item = html.match(
        /<div\b[^>]*>(?:(?!<div\b)[\s\S])*?Redeploy<\/div>/
      )?.[0];
      expect(item).toBeDefined();
      expect(item?.includes('aria-disabled="true"')).toBe(disabled);
    }
  }
});
