import { describe, expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IntlProvider } from "use-intl";

import de from "../messages/de.json";
import en from "../messages/en.json";
import type { RepositorySuggestionsResult } from "../src/types/sites";

if (!process.env.NOTRA_SITE_BULK_TEST_WORKER) {
  test("bulk import create flow", () => {
    const result = spawnSync(
      process.execPath,
      ["test", fileURLToPath(import.meta.url)],
      {
        cwd: fileURLToPath(new URL("../../..", import.meta.url)),
        env: { ...process.env, NOTRA_SITE_BULK_TEST_WORKER: "1" },
        timeout: 30_000,
      }
    );
    expect(result.status, result.stderr?.toString()).toBe(0);
  });
} else {
  mock.module("../src/components/framework/link", () => ({
    default: ({ children, ...props }: ComponentProps<"a">) => (
      <a {...props}>{children}</a>
    ),
  }));
  const {
    isSiteBulkReady,
    siteBulkCreateInput,
    siteBulkDefaultName,
    siteBulkResultsByDirectory,
    siteBulkRows,
    siteBulkSlugIssues,
  } = await import("../src/utils/site-create-bulk");
  const { SiteCreateBulkFields } =
    await import("../src/components/sites/site-create-bulk-fields");
  const { SiteCreateBulkResults } =
    await import("../src/components/sites/site-create-bulk-results");

  const directories = ["", "examples/sites/dark-launch", "docs/api_reference"];
  const contentCounts = {
    "": { blog: 0, changelog: 0 },
    "examples/sites/dark-launch": { blog: 4, changelog: 0 },
    "docs/api_reference": { blog: 0, changelog: 2 },
  };
  const rowsWith = (edits = {}, results = {}) =>
    siteBulkRows({
      directories,
      contentCounts,
      repositoryName: "notra-examples",
      edits,
      results,
    });
  const suggestions: RepositorySuggestionsResult = {
    branches: ["main"],
    defaultBranch: "main",
    configDirectories: directories,
    contentCounts,
    isLoading: false,
    isReady: true,
    isComplete: true,
  };
  const target = {
    organizationId: "organization",
    repositoryId: "repository",
    projectId: "project",
  };

  test("defaults name, address and sections per folder", () => {
    expect(siteBulkDefaultName("", "notra-examples")).toBe("notra-examples");
    expect(siteBulkDefaultName("examples/sites/dark-launch/", "repo")).toBe(
      "Dark launch"
    );
    const [root, dark, api] = rowsWith();
    expect(root).toMatchObject({ name: "notra-examples", selected: true });
    expect(root?.sections).toMatchObject({
      blogPath: "/blog",
      changelogPath: "/changelog",
    });
    expect(dark).toMatchObject({ name: "Dark launch", slug: "dark-launch" });
    expect(dark?.sections).toMatchObject({
      blogPath: "/blog",
      changelogPath: "",
    });
    expect(api).toMatchObject({ name: "Api reference", slug: "api-reference" });
    expect(api?.sections).toMatchObject({
      blogPath: "",
      changelogPath: "/changelog",
    });
  });

  test("flags invalid, reserved and duplicate addresses of selected rows", () => {
    const rows = rowsWith({
      "": { slug: "dark-launch" },
      "docs/api_reference": { slug: "x" },
    });
    expect(siteBulkSlugIssues(rows)).toEqual({
      "": "duplicate",
      "examples/sites/dark-launch": "duplicate",
      "docs/api_reference": "invalid",
    });
    const selected = rowsWith({
      "": { selected: false },
      "docs/api_reference": { name: " " },
    }).filter((row) => row.selected);
    expect(siteBulkSlugIssues(selected)).toEqual({});
    expect(isSiteBulkReady(selected, {})).toBe(false);
  });

  test("submits the rows and maps results back by position", () => {
    const rows = rowsWith().slice(1);
    const input = siteBulkCreateInput(rows, target, {
      branch: " main ",
      previewsEnabled: false,
    });
    expect(input).toMatchObject({
      productionBranch: "main",
      previewsEnabled: false,
      sites: [
        {
          name: "Dark launch",
          slug: "dark-launch",
          rootDirectory: "examples/sites/dark-launch",
          mounts: { blog: "/blog", changelog: undefined },
        },
        {
          name: "Api reference",
          rootDirectory: "docs/api_reference",
          mounts: { blog: undefined, changelog: "/changelog" },
        },
      ],
    });
    const failure = { rootDirectory: "docs/api_reference", error: "Taken" };
    expect(
      siteBulkResultsByDirectory(rows, [
        { rootDirectory: "examples/sites/dark-launch", error: "Boom" },
        failure,
      ])
    ).toEqual({
      "examples/sites/dark-launch": {
        rootDirectory: "examples/sites/dark-launch",
        error: "Boom",
      },
      "docs/api_reference": failure,
    });
  });

  describe.each([
    ["en", en],
    ["de", de],
  ] as const)("%s bulk UI", (locale, messages) => {
    const copy = messages.sites.new.bulk;

    test(`${locale}: every row has a labelled checkbox, name and address`, () => {
      const rows = rowsWith({}, {});
      const html = renderToStaticMarkup(
        <IntlProvider locale={locale} messages={messages} timeZone="UTC">
          <SiteCreateBulkFields
            branch="main"
            branchLocked={false}
            disabled={false}
            hostingDomain="notra.site"
            idPrefix="create"
            issues={siteBulkSlugIssues(rows)}
            onBranchChange={() => {}}
            onPreviewsChange={() => {}}
            onRowChange={() => {}}
            onSelectAll={() => {}}
            previewsEnabled={false}
            repository={null}
            rows={rows}
            suggestions={suggestions}
          />
        </IntlProvider>
      );
      expect(html).toContain(`aria-label="${copy.selectAll}"`);
      expect(html).toContain(
        `aria-label="${copy.select.replace("{folder}", "examples/sites/dark-launch")}"`
      );
      expect(html).toContain(
        copy.nameLabel.replace("{folder}", "docs/api_reference")
      );
      expect(html).toContain(
        copy.addressLabel.replace("{folder}", copy.rootFolder)
      );
      expect(html).toContain(".notra.site");
      expect(html).toContain('value="Dark launch"');
      expect(html).toContain(copy.previews);
    });

    test(`${locale}: results link created sites and offer a retry`, () => {
      const [created, failed] = rowsWith().slice(1);
      if (!(created && failed)) {
        throw new Error("Expected two rows");
      }
      const html = renderToStaticMarkup(
        <IntlProvider locale={locale} messages={messages} timeZone="UTC">
          <SiteCreateBulkResults
            isRetrying={false}
            onEdit={() => {}}
            onRetry={() => {}}
            organizationSlug="acme"
            rows={[
              {
                ...created,
                result: {
                  rootDirectory: created.rootDirectory,
                  deploymentQueued: true,
                  site: {
                    id: "site_1",
                    projectId: "project",
                    name: "Dark launch",
                  },
                } as never,
              },
              {
                ...failed,
                result: { rootDirectory: failed.rootDirectory, error: "Taken" },
              },
            ]}
          />
        </IntlProvider>
      );
      expect(html).toContain('href="/acme/sites/site_1?project=project"');
      expect(html).toContain("Taken");
      expect(html).toContain(copy.edit);
      expect(html).toContain(copy.created);
    });
  });
}
