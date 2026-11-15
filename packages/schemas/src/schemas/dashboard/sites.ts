import {
  SITE_PREVIEW_PASSWORD_MAX_LENGTH,
  SITE_PREVIEW_PASSWORD_MIN_LENGTH,
} from "@notra/sites-core/constants/sites";
import {
  SITE_IMAGE_UPLOAD_KINDS,
  SITE_IMAGE_UPLOAD_MAX_BYTES,
} from "@notra/sites-core/constants/uploads";
import { siteIntegrationUpdateSchema } from "@notra/sites-core/schemas/site-integrations";
import { isValidGitBranch } from "@notra/sites-core/utils/git-branch";
import z from "zod";

import { SITE_BULK_IMPORT_MAX_SITES } from "../../constants/dashboard/sites";

const organizationId = z.string().min(1);
const siteId = z.string().startsWith("site_");
const deploymentId = z.string().startsWith("dep_");
const mountPath = z.string().trim().max(80);
const previewPassword = z
  .string()
  .min(SITE_PREVIEW_PASSWORD_MIN_LENGTH)
  .max(SITE_PREVIEW_PASSWORD_MAX_LENGTH)
  .nullable();

const siteMountsInputSchema = z
  .object({
    blog: mountPath.optional(),
    changelog: mountPath.optional(),
  })
  .refine((mounts) => Boolean(mounts.blog ?? mounts.changelog), {
    message: "Enable the blog, the changelog, or both",
  });

export const siteBranchNameSchema = z
  .string()
  .min(1)
  .max(250)
  .refine(isValidGitBranch, "Invalid Git branch name");

export const siteScopeInputSchema = z.object({ organizationId, siteId });

export const listSitesInputSchema = z.object({
  organizationId,
  projectId: z.string().min(1),
});

const analyticsDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const siteAnalyticsInputSchema = siteScopeInputSchema.extend({
  days: z.number().int().min(1).max(365).optional(),
  from: analyticsDay.optional(),
  to: analyticsDay.optional(),
  path: z.string().trim().max(2048).optional(),
});

const suggestionRef = z.string().trim().max(250).optional();

export const repositorySuggestionsInputSchema = z.object({
  organizationId,
  repositoryId: z.string().min(1),
  ref: suggestionRef,
});

export const siteRepositorySuggestionsInputSchema = siteScopeInputSchema.extend(
  { ref: suggestionRef }
);

export const createSiteInputSchema = z.object({
  organizationId,
  name: z.string().trim().min(1).max(80),
  slug: z.string().trim().toLowerCase().max(40).optional(),
  repositoryId: z.string().min(1),
  productionBranch: siteBranchNameSchema.optional(),
  rootDirectory: z.string().trim().max(200).optional(),
  mounts: siteMountsInputSchema,
  previewVisibility: z.enum(["public", "protected"]).default("protected"),
  projectId: z.string().min(1),
});

export const createSitesInputSchema = z.object({
  organizationId,
  projectId: z.string().min(1),
  repositoryId: z.string().min(1),
  productionBranch: siteBranchNameSchema.optional(),
  previewsEnabled: z.boolean().default(false),
  sites: z
    .array(
      createSiteInputSchema.pick({
        name: true,
        slug: true,
        rootDirectory: true,
        mounts: true,
      })
    )
    .min(1)
    .max(SITE_BULK_IMPORT_MAX_SITES),
});

export const updateSiteInputSchema = siteScopeInputSchema.extend({
  name: z.string().trim().min(1).max(80).optional(),
  repositoryId: z.string().min(1).optional(),
  productionBranch: siteBranchNameSchema.optional(),
  rootDirectory: z.string().trim().max(200).optional(),
  mounts: siteMountsInputSchema.optional(),
  previewsEnabled: z.boolean().optional(),
  smartDeployments: z.boolean().optional(),
  previewCommentsEnabled: z.boolean().optional(),
  previewVisibility: z.enum(["public", "protected"]).optional(),
  showBranding: z.boolean().optional(),
  analyticsEnabled: z.boolean().optional(),
  previewPassword: previewPassword.optional(),
});

export const setSiteSuspendedInputSchema = siteScopeInputSchema.extend({
  suspended: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});

export const siteDeploymentInputSchema = siteScopeInputSchema.extend({
  deploymentId,
});

export const listSiteDeploymentsInputSchema = siteScopeInputSchema.extend({
  limit: z.number().int().min(1).max(100).default(30),
});

export const siteBranchPreviewInputSchema = siteScopeInputSchema.extend({
  branch: siteBranchNameSchema,
});

export const sitePreviewInputSchema = siteScopeInputSchema.extend({
  previewKey: z.string().regex(/^(?:pr|br|post)-[a-z0-9-]{1,40}$/),
});

export const sitePostPreviewInputSchema = siteScopeInputSchema.extend({
  postId: z.string().min(1).max(64),
});

const postPreviewLifetime = z.enum(["1h", "1d", "3d", "7d"]);

export const createPostPreviewInputSchema = sitePostPreviewInputSchema.extend({
  lifetime: postPreviewLifetime.default("7d"),
  password: previewPassword.optional(),
});

export const updatePostPreviewAccessInputSchema =
  sitePostPreviewInputSchema.extend({
    lifetime: postPreviewLifetime.optional(),
    password: previewPassword.optional(),
  });

export const postPreviewSitesInputSchema = z.object({
  organizationId,
  postId: z.string().min(1).max(64),
});

export const sitePreviewAccessInputSchema = sitePreviewInputSchema.extend({
  kind: z.enum(["member", "share"]).default("member"),
  next: z.string().max(500).optional(),
});

export const siteSetPreviewPasswordInputSchema = siteScopeInputSchema.extend({
  password: previewPassword,
});

export const addSiteDomainInputSchema = siteScopeInputSchema.extend({
  kind: z.enum(["subdomain", "proxy"]),
  value: z.string().trim().min(3).max(253),
});

export const siteDomainInputSchema = siteScopeInputSchema.extend({
  domainId: z.string().startsWith("dom_"),
});

export const siteEditorScopeInputSchema = siteScopeInputSchema.extend({
  branch: siteBranchNameSchema.optional(),
});

export const siteBranchInputSchema = siteEditorScopeInputSchema.extend({
  branch: siteBranchNameSchema,
});

export const siteBranchFlushInputSchema = siteBranchInputSchema.extend({
  skipIfBusy: z.boolean().default(false),
});

export const siteBranchesListInputSchema = siteScopeInputSchema.extend({
  search: z.string().trim().max(250).default(""),
});

export const siteBranchCreateInputSchema = siteEditorScopeInputSchema.extend({
  title: z
    .string()
    .trim()
    .max(100)
    .refine(
      (title) => !title || isValidGitBranch(title.replaceAll(" ", "-")),
      "Invalid branch title"
    )
    .default(""),
  bringChanges: z.boolean(),
});

export const siteBranchRenameInputSchema = siteBranchInputSchema.extend({
  title: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .refine(
      (title) => isValidGitBranch(title.replaceAll(" ", "-")),
      "Invalid branch title"
    ),
});

export const siteFilePathInputSchema = siteEditorScopeInputSchema.extend({
  path: z.string().trim().min(1).max(400),
});

export const siteDraftMutationInputSchema = siteFilePathInputSchema.extend({
  draftId: z.string().min(1).nullable(),
  draftRevision: z.number().int().nonnegative().nullable(),
  sourceContext: z.object({
    repositoryId: z.string(),
    productionBranch: z.string().min(1),
    rootDirectory: z.string(),
  }),
});

export const saveSiteDraftInputSchema = siteDraftMutationInputSchema.extend({
  content: z.string().max(512 * 1024),
  baseBlobSha: z.string().nullable(),
  baseCommitSha: z.string().nullable(),
  deleted: z.boolean().optional(),
});

export const uploadSiteImageInputSchema = siteEditorScopeInputSchema.extend({
  fileName: z.string().trim().min(1).max(200),
  kind: z.enum(SITE_IMAGE_UPLOAD_KINDS),
  /** Base64 file bytes; the server checks the decoded size and type. */
  data: z
    .string()
    .min(1)
    .max(Math.ceil((SITE_IMAGE_UPLOAD_MAX_BYTES * 4) / 3) + 4),
  baseCommitSha: z.string().nullable(),
  sourceContext: siteDraftMutationInputSchema.shape.sourceContext,
});

export const publishSiteDraftsInputSchema = siteEditorScopeInputSchema.extend({
  message: z.string().trim().min(1).max(200).optional(),
});

export const saveSiteIntegrationInputSchema = siteEditorScopeInputSchema.and(
  siteIntegrationUpdateSchema
);

export const connectSiteInthProjectInputSchema =
  siteEditorScopeInputSchema.extend({
    projectId: z.string().trim().min(1).max(100),
  });

export const connectSiteRepositoryInputSchema = z.object({
  organizationId,
  githubRepositoryId: z.string().trim().min(1).max(40),
});

export const siteStarterInputSchema = z.object({
  organizationId,
  repositoryId: z.string().min(1),
  branch: z.string().trim().max(250).default(""),
  rootDirectory: z.string().trim().max(250).default(""),
});
