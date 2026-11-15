import type { sites } from "@notra/db/schema";
import type { POST_PREVIEW_LIFETIMES } from "@notra/sites-core/constants/sites";
import type { SiteMounts } from "@notra/sites-core/types/deployment";
import type {
  SiteSuspender,
  SiteSuspensionCategory,
} from "@notra/sites-core/types/sites";
import type { z } from "zod";

import type { postPreviewSourceSchema } from "../schemas/post-preview";

export type Site = typeof sites.$inferSelect;

export type SiteInputField =
  | "repository"
  | "name"
  | "slug"
  | "rootDirectory"
  | "sections";

export interface SiteNameRejection {
  message: string;
  field: "name" | "slug";
}

export interface SiteNameRejectionParams {
  organizationId: string;
  userId: string;
  name: string;
  address: string;
  slug?: string;
}

export type SiteUpdateValues = Partial<typeof sites.$inferInsert>;

export interface CreateSiteInput {
  organizationId: string;
  userId: string;
  projectId: string;
  name: string;
  slug?: string;
  repositoryId: string;
  productionBranch?: string;
  rootDirectory?: string;
  mounts?: SiteMounts;
  previewVisibility?: Site["previewVisibility"];
  previewsEnabled?: boolean;
}

export interface RepositorySuggestionsParams {
  organizationId: string;
  repositoryId: string;
  ref: string | null;
}

export interface DeployBranchHeadOptions {
  commitSha?: string;
  trigger: "manual" | "config" | "redeploy";
  userId?: string | null;
  branch?: string;
  previewKey?: string | null;
  /** Shown instead of the head commit's message. */
  commitMessage?: string;
}

export interface SiteSettingsPatch {
  name?: string;
  repositoryId?: string;
  productionBranch?: string;
  rootDirectory?: string;
  mounts?: SiteMounts;
  previewsEnabled?: boolean;
  smartDeployments?: boolean;
  previewCommentsEnabled?: boolean;
  previewVisibility?: Site["previewVisibility"];
  showBranding?: boolean;
  analyticsEnabled?: boolean;
  previewPassword?: string | null;
  publicOrigin?: string;
}

export interface CreateSiteResult {
  site: Site;
  jobId: string | null;
}

export interface BranchPreviewResult {
  jobId: string;
  previewKey: string;
}

export interface UpdateSiteSettingsResult {
  site: Site;
  syncJobId: string;
  rebuilding: boolean;
}

export interface SiteCleanupResult {
  deleted: string[];
}

export interface PostPreviewFile {
  /** Path inside the site's root directory. */
  path: string;
  contents: Uint8Array;
}

export type PostPreviewSource = z.infer<typeof postPreviewSourceSchema>;
export type PostPreviewLifetime = keyof typeof POST_PREVIEW_LIFETIMES;

export interface PostPreviewAccessInput {
  lifetime: PostPreviewLifetime;
  /** Null opens the preview to anyone with the link; undefined keeps the current one. */
  password?: string | null;
}

export interface CreatePostPreviewInput extends PostPreviewAccessInput {
  postId: string;
  title: string;
  pagePath: string;
  files: PostPreviewFile[];
  userId?: string;
}

export interface UpdatePostPreviewAccessInput {
  lifetime?: PostPreviewLifetime;
  /** Undefined keeps the current password. */
  password?: string | null;
}

export interface SetSiteSuspendedOptions {
  by?: SiteSuspender;
  reason?: string;
  /** Shown to visitors on the 410 page; only for Notra suspensions. */
  category?: SiteSuspensionCategory;
  actorUserId?: string | null;
  withOrganization?: boolean;
}

export interface SetOrganizationSuspendedInput {
  organizationId: string;
  suspended: boolean;
  reason: string;
  category?: SiteSuspensionCategory;
  actorUserId: string;
}

interface SuspensionNotice {
  /** Keys the owner email, so a retry re-sends only notices that failed. */
  key: string;
  category: SiteSuspensionCategory;
  reason: string;
}

/** What a site suspension or lift did. */
export interface SiteTransitionResult {
  changed: boolean;
  /** The site was already in the requested state. */
  retry: boolean;
  /** The owner notice of a Notra suspension, stable across retries. */
  notice: SuspensionNotice | null;
}

export interface SetOrganizationSuspendedResult {
  organization: { id: string; name: string; slug: string };
  /** The workspace was already in the requested state; this finished it. */
  retry: boolean;
  /** Sites this action took offline or restored. */
  sites: Site[];
  /** Sites that failed and kept their state; repeating the action finishes them. */
  failed: number;
  /** The owner notice for a suspension, stable across retries. */
  notice: (SuspensionNotice & { siteNames: string[] }) | null;
}
