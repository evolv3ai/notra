import { createORPCClient, ORPCError } from "@orpc/client";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import {
  QueryClient,
  QueryClientProvider,
  useIsFetching,
} from "@tanstack/react-query";
import { type ComponentProps, useState } from "react";
import { createRoot } from "react-dom/client";
import { IntlProvider } from "use-intl";

import messages from "../../messages/en.json";
import { SiteDesignPage } from "../../src/components/sites/pages/site-design-page";
import { SiteChangesBanner } from "../../src/components/sites/site-changes-banner";
import { SiteContext } from "../../src/components/sites/site-context";
import { SiteVariablesSettings } from "../../src/components/sites/site-variables-settings";
import { SiteWorkspace } from "../../src/components/sites/site-workspace";
import { useSiteWorkspace } from "../../src/components/sites/site-workspace-context";
import { SITE_DESIGN_SECTIONS } from "../../src/constants/site-design-sections";
import type { DashboardORPCClient } from "../../src/lib/orpc/client";
import type { SitePublishDialogProps } from "../../src/types/components/sites";
import type { SiteBranchControlsProps } from "../../src/types/site-branches";
import type { SiteDraftInput } from "../../src/types/site-drafts";
import type { SiteContextValue, SiteScope } from "../../src/types/sites";
import type {
  WorkspaceFixtureBlocker,
  WorkspaceFixtureRecord,
} from "../types/site-workspace";

const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});
const records = new Map<string, WorkspaceFixtureRecord>();
const sourceContext = {
  repositoryId: "",
  productionBranch: "main",
  rootDirectory: "",
};
let releaseRead = () => {};
let releaseRebase = () => {};
const cold = new URLSearchParams(location.search).has("cold");
const broken = new URLSearchParams(location.search).has("broken");
let readGate = cold
  ? new Promise<void>((resolve) => {
      releaseRead = resolve;
    })
  : Promise.resolve();
let rebaseGate = Promise.resolve();
let failedRead: string | null = null;
let blockNavigation: WorkspaceFixtureBlocker["shouldBlockFn"] = async () =>
  false;
let activeSection: (typeof SITE_DESIGN_SECTIONS)[number] =
  SITE_DESIGN_SECTIONS[0];
let finishUpload = () => {};
const SITE_PATH = "/synthetic/sites/site-a";
const NAVIGATIONS = [
  ["Navigate away", "/synthetic/projects", {}, "left"],
  ["Open Styling", `${SITE_PATH}/design`, { section: "styling" }, "Styling"],
  ["Open General", `${SITE_PATH}/design`, { section: "general" }, "General"],
  ["Open Settings page", `${SITE_PATH}/settings`, {}, "Settings page"],
  [
    "Open another branch",
    `${SITE_PATH}/design`,
    { branch: "feature" },
    "Branch",
  ],
  [
    "Open another project",
    `${SITE_PATH}/design`,
    { project: "other" },
    "Project",
  ],
] as const;

function record(scope: SiteScope) {
  const key = JSON.stringify([scope.organizationId, scope.siteId]);
  let value = records.get(key);
  if (!value) {
    const content = JSON.stringify({
      name: scope.siteId,
      description: `${scope.siteId} description`,
      variables: { product_name: scope.siteId },
      ...(broken
        ? {
            colors: { primary: "#8B5CF6FF" },
            footer: { socials: { x: "twitter.com/acme" } },
            redirects: [
              { source: "/old", destination: "/new" },
              { source: "missing-slash", destination: "/new" },
            ],
          }
        : {}),
    });
    value = {
      document: {
        path: "blog.json",
        encoding: "utf8" as const,
        content,
        published: content,
        blobSha: "blob-1",
        publishedBlobSha: "blob-1",
        hasDraft: true,
        draftId: `draft-${key}`,
        draftRevision: 1,
        sourceContext,
      },
      files: {
        commitSha: "commit-1",
        sourceContext,
        files: [],
        drafts: [
          {
            path: "blog.json",
            id: `draft-${key}`,
            revision: 1,
            deleted: false,
            baseBlobSha: "blob-1",
            updatedAt: new Date(),
          },
        ],
      },
    };
    records.set(key, value);
  }
  return value;
}

const rpc = createORPCClient<DashboardORPCClient>({
  call: async (path, input) => {
    const value = record(input as SiteScope);
    switch (path.join(".")) {
      case "sites.editor.read":
        await readGate;
        if (failedRead === "read") {
          throw new Error("Synthetic document read failure");
        }
        return structuredClone(value.document);
      case "sites.editor.files":
        await readGate;
        if (failedRead === "files") {
          throw new Error("Synthetic files read failure");
        }
        return structuredClone(value.files);
      case "sites.editor.rebaseDraft": {
        const draft = input as SiteDraftInput;
        if (draft.draftRevision !== value.document.draftRevision) {
          throw new ORPCError("CONFLICT", { data: { paths: ["blog.json"] } });
        }
        await rebaseGate;
        value.document = {
          ...value.document,
          draftRevision: (value.document.draftRevision ?? 0) + 1,
          blobSha: "blob-2",
        };
        value.files.drafts[0]!.revision = value.document.draftRevision!;
        return { path: "blog.json" };
      }
      case "sites.editor.saveDraft": {
        const draft = input as SiteDraftInput;
        if (draft.draftRevision !== value.document.draftRevision) {
          throw new ORPCError("CONFLICT", { data: { paths: ["blog.json"] } });
        }
        value.document = {
          ...value.document,
          content: draft.content,
          draftRevision: (draft.draftRevision ?? 0) + 1,
        };
        value.files.drafts[0]!.revision = value.document.draftRevision!;
        return {
          path: draft.path,
          draftId: value.document.draftId,
          draftRevision: value.document.draftRevision,
          updatedAt: new Date(),
        };
      }
      default:
        throw new Error(`Unexpected RPC ${path.join(".")}`);
    }
  },
});
export const dashboardOrpc = createTanstackQueryUtils(rpc, {
  path: ["dashboard"],
});

// Browser-only boundaries; workspace, query lifecycle, forms and save queues are real.
export const parseAsString = null;
export function useQueryState() {
  return [null, async () => {}] as const;
}
export function useLocation() {
  return { pathname: "/", search: {}, hash: "" };
}
export function Link({
  to,
  children,
  ...props
}: { to: string } & ComponentProps<"a">) {
  return (
    <a {...props} href={to}>
      {children}
    </a>
  );
}
export function useBlocker(options: WorkspaceFixtureBlocker) {
  blockNavigation = options.disabled
    ? async () => false
    : options.shouldBlockFn;
}
export function useSiteDesignSection() {
  return { active: activeSection, select: () => {} };
}
export function useSiteNavSection() {
  return { current: "design", section: "design", branch: null } as const;
}
export function useSiteBrandDefaults() {
  return { brand: null, available: false };
}
export function useProjectBrandDefaults() {
  return useSiteBrandDefaults();
}
export function SiteDesignIntegrations() {
  return null;
}
export function useSiteWorkingBranch() {
  return {
    commitStatus: "idle",
    switchBranch: async () => {},
    flush: async () => {},
  };
}
export function useSiteBranchControls(props: SiteBranchControlsProps) {
  return { props, retrySave: () => {} };
}
export function SiteBranchActionDialog() {
  return null;
}
export function SitePublishDialog({
  open,
  onOpenChange,
  onRebase,
}: SitePublishDialogProps) {
  return open ? (
    <div role="dialog" aria-label="Publish">
      <button type="button" onClick={onRebase}>
        Start rebase
      </button>
      <button type="button" onClick={() => onOpenChange(false)}>
        Dismiss
      </button>
    </div>
  ) : null;
}

function WorkspaceFields() {
  const state = useSiteWorkspace();
  const [owner] = useState(() => crypto.randomUUID());
  const [navigation, setNavigation] = useState("");
  const [designOpen, setDesignOpen] = useState(true);
  return (
    <>
      <nav aria-label="Site pages">
        {["Design", "Settings", "Choose branch"].map((label) => (
          <button
            type="button"
            key={label}
            onClick={async () => {
              if (label === "Choose branch") {
                await state?.controller.props.onFlush();
              }
              setNavigation(label);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {NAVIGATIONS.map(([label, pathname, search, result]) => (
        <button
          type="button"
          key={label}
          onClick={async () => {
            setNavigation("");
            if (await blockNavigation({ next: { pathname, search } })) {
              setNavigation("blocked");
              return;
            }
            const section = SITE_DESIGN_SECTIONS.find(
              (item) => "section" in search && item.id === search.section
            );
            activeSection = section ?? activeSection;
            if (pathname.startsWith(SITE_PATH)) {
              setDesignOpen(pathname.endsWith("/design"));
            }
            setNavigation(result);
          }}
        >
          {label}
        </button>
      ))}
      <output data-testid="navigation">{navigation}</output>
      <output data-testid="owner">{owner}</output>
      <output data-testid="config">{JSON.stringify(state?.config)}</output>
      <output data-testid="status">{state?.saves.state.status}</output>
      <output data-testid="persisted">
        {state ? record(state.scope).document.content : ""}
      </output>
      <SiteVariablesSettings />
      {state ? (
        <>
          <SiteChangesBanner />
          {designOpen ? <SiteDesignPage /> : null}
          <button
            type="button"
            onClick={() => {
              state.setConflicts(["blog.json"]);
              state.setPublishOpen(true);
            }}
          >
            Open publish
          </button>
          <button
            type="button"
            onClick={() => {
              state.update({ ...state.config, name: "Blocked edit" });
              state.updateVariables([
                { id: "blocked", name: "blocked", value: "blocked" },
              ]);
            }}
          >
            Attempt edits
          </button>
          <button
            type="button"
            onClick={() => {
              finishUpload = state.beginImageUpload();
            }}
          >
            Start upload
          </button>
          <button type="button" onClick={() => finishUpload()}>
            Finish upload
          </button>
          <button
            type="button"
            onClick={() => {
              void state.saves.flush().catch(() => {});
            }}
          >
            Flush
          </button>
        </>
      ) : null}
    </>
  );
}

function QueryStatus() {
  return <output data-testid="fetching">{useIsFetching()}</output>;
}

function Fixture() {
  const [siteId, setSiteId] = useState("site-a");
  const [organizationId, setOrganizationId] = useState("org-a");
  const scope = { organizationId, siteId };
  const value = record(scope);
  const context = {
    organizationId,
    siteId,
    organizationSlug: "synthetic",
    detail: {
      site: {
        productionBranch: "main",
        rootDirectory: "",
        projectId: "project",
      },
    },
    liveDeployment: null,
  } as SiteContextValue;
  return (
    <IntlProvider locale="en" messages={messages}>
      <QueryClientProvider client={client}>
        <QueryStatus />
        {["read", "files"].map((kind) => (
          <button
            type="button"
            key={kind}
            onClick={() => {
              failedRead = kind;
              void client.invalidateQueries({
                queryKey:
                  kind === "read"
                    ? dashboardOrpc.sites.editor.read.key()
                    : dashboardOrpc.sites.editor.files.key(),
              });
            }}
          >
            Fail {kind}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            failedRead = null;
          }}
        >
          Allow reads
        </button>
        <button
          type="button"
          onClick={() => {
            failedRead = "read";
          }}
        >
          Fail next read
        </button>
        <button type="button" onClick={() => releaseRead()}>
          Finish load
        </button>
        <button
          type="button"
          onClick={() => {
            const other = {
              ...scope,
              siteId: siteId === "site-a" ? "site-b" : "site-a",
            };
            const next = record(other);
            client.setQueryData(
              dashboardOrpc.sites.editor.read.queryKey({
                input: { ...other, path: "blog.json" },
              }),
              next.document
            );
            client.setQueryData(
              dashboardOrpc.sites.editor.files.queryKey({ input: other }),
              next.files
            );
            setSiteId(other.siteId);
          }}
        >
          Switch site
        </button>
        <button type="button" onClick={() => setOrganizationId("org-b")}>
          Switch organization
        </button>
        <button
          type="button"
          onClick={() => {
            const config = JSON.parse(value.document.content);
            value.document = {
              ...value.document,
              draftRevision: (value.document.draftRevision ?? 0) + 1,
              content: JSON.stringify({
                ...config,
                description: "Teammate description",
                variables: { ...config.variables, teammate: "Preserve me" },
              }),
            };
            value.files.drafts[0]!.revision = value.document.draftRevision!;
            void client.invalidateQueries({
              queryKey: dashboardOrpc.sites.editor.read.key(),
            });
          }}
        >
          Teammate refresh
        </button>
        <button
          type="button"
          onClick={() => {
            rebaseGate = new Promise<void>((resolve) => {
              releaseRebase = resolve;
            });
            readGate = new Promise<void>((resolve) => {
              releaseRead = resolve;
            });
          }}
        >
          Hold rebase
        </button>
        <button type="button" onClick={() => releaseRebase()}>
          Finish rebase
        </button>
        <button
          type="button"
          onClick={() => {
            void client.resetQueries({
              queryKey: dashboardOrpc.sites.editor.read.key(),
            });
          }}
        >
          Reset document
        </button>
        <button
          type="button"
          onClick={() => {
            client.setQueryData(
              dashboardOrpc.sites.editor.read.queryKey({
                input: { ...scope, path: "blog.json" },
              }),
              structuredClone(value.document)
            );
          }}
        >
          Restore document
        </button>
        <SiteContext value={context}>
          <SiteWorkspace>
            <WorkspaceFields />
          </SiteWorkspace>
        </SiteContext>
      </QueryClientProvider>
    </IntlProvider>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<Fixture />);
}
