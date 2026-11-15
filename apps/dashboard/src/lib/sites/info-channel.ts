import { db } from "@notra/db/drizzle";
import { organizations } from "@notra/db/schema";
import type { Site } from "@notra/sites-server/types/sites";
import { eq } from "drizzle-orm";

import { notifyInfoChannel } from "@/lib/slack/info-channel";
import { consoleSiteUrl } from "@/utils/console-links";

async function workspaceLabel(organizationId: string): Promise<string> {
  const [organization] = await db
    .select({ name: organizations.name, slug: organizations.slug })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  return organization
    ? `${organization.name} (${organization.slug})`
    : organizationId;
}

/** One message per call, so a bulk import doesn't burst the Slack webhook. */
export function notifySitesCreated(sites: Site[], createdBy: string): void {
  const [first] = sites;
  if (!first) {
    return;
  }
  notifyInfoChannel(async () => ({
    emoji: ":globe_with_meridians:",
    title:
      sites.length === 1 ? "Site created" : `${sites.length} sites created`,
    fields: {
      Workspace: await workspaceLabel(first.organizationId),
      [sites.length === 1 ? "Site" : "Sites"]: sites
        .map((site) => `${site.name} (${site.publicOrigin})`)
        .join(", "),
      Repository: [
        ...new Set(
          sites.map((site) => `${site.repositoryOwner}/${site.repositoryName}`)
        ),
      ].join(", "),
      "Created by": createdBy,
    },
    links: [
      ...(sites.length === 1
        ? [
            {
              label: "Suspend site",
              url: consoleSiteUrl(first.id, "suspend-site"),
              danger: true,
            },
          ]
        : []),
      {
        label: "Suspend workspace",
        url: consoleSiteUrl(first.id, "suspend-workspace"),
        danger: true,
      },
      {
        label: "Ban owner",
        url: consoleSiteUrl(first.id, "ban-owner"),
        danger: true,
      },
      { label: "Open in console", url: consoleSiteUrl(first.id) },
    ],
  }));
}

export function notifyDomainConnected(site: Site, hostname: string): void {
  notifyInfoChannel(async () => ({
    emoji: ":link:",
    title: "Domain connected",
    fields: {
      Workspace: await workspaceLabel(site.organizationId),
      Site: site.name,
      Domain: hostname,
    },
  }));
}
