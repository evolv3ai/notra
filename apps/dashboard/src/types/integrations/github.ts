import type { WebhookConfig } from "@notra/ai/types/integrations";
import type { createOctokit } from "@notra/ai/utils/octokit";
import { Data } from "effect";
import type React from "react";
import type { useTranslations } from "use-intl";

import type { useGitHubWebhookActions } from "@/hooks/use-github-webhook-actions";

import type messages from "../../../messages/en.json";
import type { GitHubIntegration, GitHubRepository } from "../integrations";

export interface GitHubRepositoryRowProps {
  integration: GitHubIntegration;
  organizationId: string;
  onMigrate: (integration: GitHubIntegration) => void;
  isMigrating: boolean;
  onManageRepositories: () => void;
}

export interface GitHubRepositoryActionsProps {
  onMigrate: () => void;
  isMigrating: boolean;
  webhook: GitHubWebhookActions | null;
  integration: GitHubIntegration;
  organizationId: string;
  onManageRepositories: () => void;
}

export type GitHubRepositoryDialog = "edit" | "token" | "delete" | null;

export interface GitHubRepositoryMenuProps extends GitHubRepositoryActionsProps {
  isEnabled: boolean;
  isPending: boolean;
  onToggle: () => void;
  onDialog: (dialog: GitHubRepositoryDialog) => void;
}

export type GitHubWebhookAction = "setup" | "repair" | "rotate";

export interface UseGitHubWebhookActionsOptions {
  organizationId: string;
  repository: GitHubRepository | undefined;
}

type GitHubWebhookActions = ReturnType<typeof useGitHubWebhookActions>;

export interface GitHubWebhookSettingsProps {
  repository: GitHubRepository;
  webhook: GitHubWebhookActions;
}

export interface GitHubSettingRowProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  htmlFor?: string;
  children?: React.ReactNode;
}

export interface GitHubWebhookCredentialsProps {
  webhook: Pick<WebhookConfig, "webhookUrl" | "webhookSecret">;
}

export interface GitHubWebhookRotationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}

export interface GitHubWebhookRepairDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
  disabled: boolean;
  error: Error | null;
}

export type GitHubClient = ReturnType<typeof createOctokit>;
export type GitHubPublishContentType = "blog_post" | "changelog";

export class GitHubInstallStartError extends Data.TaggedError(
  "GitHubInstallStartError"
)<{
  readonly cause: unknown;
}> {}

export class GitHubAccountConnectionIncompleteError extends Data.TaggedError(
  "GitHubAccountConnectionIncompleteError"
)<{
  readonly callbackPath: string;
}> {}

export type GitHubAccountType = "User" | "Organization";

interface GitHubAppAccount {
  id: string;
  installationId: string;
  login: string;
  name: string | null;
  avatarUrl: string;
  type: GitHubAccountType;
  canPublish: boolean | null;
}

export interface GitHubAppRepository {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  description: string | null;
  defaultBranch: string;
}

type GitHubInstallFailureReason =
  | "account-connection-incomplete"
  | "install-start-failed";

export type StartGitHubInstallResult =
  | { started: true }
  | { started: false; reason: GitHubInstallFailureReason; message?: string };

export interface ConnectGitHubDialogProps {
  onConnect: () => void;
  isConnecting?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export interface GitHubAccountSelectProps {
  accounts: GitHubAppAccount[];
  selectedAccountId?: string;
  onSelectAccount?: (accountId: string) => void;
  onAddAccount?: () => void;
  disabled?: boolean;
}

export interface RepositoryMultiSelectProps {
  repositories: GitHubAppRepository[];
  value: string[];
  onChange: (value: string[]) => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  accounts?: GitHubAppAccount[];
  selectedAccountId?: string;
  onSelectAccount?: (accountId: string) => void;
  onAddAccount?: () => void;
}

export interface SelectRepositoriesDialogProps {
  repositories: GitHubAppRepository[];
  error?: string;
  onRetry?: () => void;
  onSave: (repositoryIds: string[]) => void;
  initialSelected?: string[];
  isLoading?: boolean;
  isSaving?: boolean;
  accounts?: GitHubAppAccount[];
  selectedAccountId?: string;
  onSelectAccount?: (accountId: string) => void;
  onAddAccount?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export interface GitHubIntegrationDialogProps {
  organizationId: string;
  organizationSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface GitHubAccountCardProps {
  isDisconnecting?: boolean;
  account: GitHubAppAccount;
  repositories: GitHubAppRepository[];
  selectedRepositoryIds: string[];
  onAddRepositories: () => void;
  onDisconnect: () => void;
}

export interface GitHubPublishingEditor {
  repositoryId: string;
  contentType: GitHubPublishContentType;
}

export interface GitHubPublishingSettingsProps {
  organizationId: string;
  repository: GitHubRepository;
  disabled?: boolean;
  openEditor: GitHubPublishingEditor | null;
  onOpenEditorChange: React.Dispatch<
    React.SetStateAction<GitHubPublishingEditor | null>
  >;
}

export interface GitHubBranchPickerProps {
  organizationId: string;
  repository: GitHubRepository;
}

export interface GitHubCreateBranchFormProps {
  baseBranch: string;
  errorMessage?: string;
  isPending: boolean;
  onCancel: () => void;
  onChange: () => void;
  onSubmit: (branchName: string) => void;
}

export interface GitHubBranchListProps {
  branches: string[];
  canCreate: boolean;
  currentBranch: string | null;
  isError: boolean;
  isLoading: boolean;
  isUpdating: boolean;
  onCreate: () => void;
  onRetry: () => void;
  onSelect: (branchName: string) => void;
}

export interface GitHubBranchPanelTransitionProps {
  branchList: React.ReactNode;
  createForm: React.ReactNode;
  creating: boolean;
}

export interface GitHubContentPublishingSettingsProps extends GitHubPublishingSettingsProps {
  contentType: GitHubPublishContentType;
}

export interface GitHubContentDirectoryMutationVariables {
  nextDirectory: string;
  targetRepositoryId: string;
}

export interface GitHubContentPathMutationVariables {
  contentPath: string | null;
  imagePath: string | null;
  targetRepositoryId: string;
}

export interface GitHubPublishingPathFieldsProps {
  contentPath: string | null;
  directory: string;
  disabled?: boolean;
  imagePath: string | null;
  isSaving?: boolean;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (paths: {
    contentPath: string | null;
    imagePath: string | null;
  }) => void;
}

export interface GitHubDirectoryPickerProps {
  contentType: GitHubPublishContentType;
  directory: string;
  disabled?: boolean;
  isSaving?: boolean;
  onSave: (directory: string) => Promise<void>;
  organizationId: string;
  repositoryId: string;
  repositoryName: string;
  triggerId?: string;
}

export interface GitHubDirectoryChoiceProps {
  depth: number;
  helper?: string;
  name: string;
  path: string;
}

export interface GitHubDirectoryEntry {
  name: string;
  path: string;
}

export interface GitHubDirectoryNodeProps {
  depth: number;
  excludedPath?: string;
  missing?: boolean;
  name: string;
  open: boolean;
  organizationId: string;
  path: string;
  repositoryId: string;
}

export interface GitHubDirectoryNodesProps {
  depth: number;
  directories: GitHubDirectoryEntry[];
  excludedPath?: string;
  open: boolean;
  organizationId: string;
  repositoryId: string;
}

export interface GitHubDirectoryExtraChoicesProps {
  customDirectories: string[];
  directory: string;
  rootDirectories: GitHubDirectoryEntry[];
}

export interface GitHubDirectoryRootContentProps {
  directory: string;
  isError: boolean;
  isLoading: boolean;
  open: boolean;
  organizationId: string;
  repositoryId: string;
  rootDirectories: GitHubDirectoryEntry[];
}

export interface GitHubDirectoryNewFolderFieldProps {
  error: string | null;
  inputId: string;
  name: string;
  onNameChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  selectedDirectory: string;
}

export interface GitHubDirectoryNodeStatusProps {
  depth: number;
  exists: boolean | undefined;
  isError: boolean;
  isLoading: boolean;
}

export interface ResolveGitHubContentPathParams {
  contentId: string;
  customPath?: string;
  directory: string;
  pathTemplate?: string | null;
  slug: string | null;
  title: string;
}

export interface FindExistingGitHubPullRequestParams {
  branchName: string;
  defaultBranch: string;
  octokit: GitHubClient;
  owner: string;
  repo: string;
}

export interface ValidateExistingGitHubBranchParams {
  baseSha: string;
  branchName: string;
  octokit: GitHubClient;
  owner: string;
  path: string;
  /** Login whose GitHub-signed commits may carry trusted publication metadata. */
  publisherLogin: string | null;
  repo: string;
}

export interface GitHubComparisonFile {
  filename: string;
  previous_filename?: string;
  status: string;
}

export interface GitHubContentCommitMetadata {
  assetPaths: string[];
  contentPath: string;
}

export interface GitHubContentAsset {
  contents: Uint8Array;
  path: string;
}

export interface GitHubSourceImageAsset {
  contents: Uint8Array;
  extension: string;
}

export interface PrepareGitHubContentAssetsParams {
  appOrigin: string | null;
  contentPath: string;
  imagePathTemplate: string;
  markdown: string;
  organizationId: string;
  publicDirectory?: string;
  publicUrl: string | null;
  slug: string;
  loadImage: (key: string, maxBytes: number) => Promise<GitHubSourceImageAsset>;
}

export interface PreparedGitHubContent {
  assets: GitHubContentAsset[];
  markdown: string;
}

export type GitHubPullRequestOperation = "created" | "updated";

export interface GitHubPublishPullRequestResult {
  branchName: string;
  operation: GitHubPullRequestOperation;
  path: string;
  pullRequestNumber: number | null;
  pullRequestUrl: string | null;
  headSha: string;
  assetPaths?: string[];
  direct?: boolean;
  fallbackReason?: "protected" | "draft" | "changed";
  skipped?: boolean;
}

export interface GitHubCreateCommitOnBranchResult {
  createCommitOnBranch: {
    commit: { oid: string };
  } | null;
}

export interface OpenInNotraBadgeUrls {
  dark: string;
  light: string;
}

export interface PublishContentDraftPullRequestParams {
  direct?: boolean;
  ownedPaths?: string[];
  writtenBlobs?: Record<string, string>;
  previousHeadSha?: string | null;
  deletions?: string[];
  contentId: string;
  contentType: GitHubPublishContentType;
  owner: string;
  repo: string;
  defaultBranch: string;
  path: string;
  title: string;
  markdown: string;
  /** Organization billed for follow-up commit-message generation. */
  organizationId?: string;
  assets?: GitHubContentAsset[];
  assetPathsToDelete?: string[];
  /** Prepares repository-local assets after an existing draft's pinned content path is known. */
  prepareContent?: (contentPath: string) => Promise<PreparedGitHubContent>;
  /**
   * Login the octokit token commits as (`{app}[bot]` or the token's user).
   * Publication metadata is only trusted on GitHub-signed commits by this login.
   */
  publisherLogin?: string;
  /** Deep link to the content in the Notra dashboard, rendered as an "Open in Notra" button. */
  contentUrl?: string;
  /** Absolute URLs of the "Open in Notra" badge images per color scheme. */
  badgeUrls?: OpenInNotraBadgeUrls;
  /**
   * Open pull request already stored for this content. A new commit is pushed
   * to its branch instead of opening another draft.
   */
  linkedPullRequest?: {
    branchName: string;
    number: number;
  };
  /**
   * Fail instead of opening a new draft when the stored pull request is not
   * open on the default branch. A pull request marked ready for review still
   * receives the update.
   */
  requireLinkedPullRequest?: boolean;
}

export interface GitHubPullRequestSummary {
  number: number;
  html_url: string;
}

export type GitHubErrorHeaders = Record<string, string | number | undefined>;

export type GitHubPublishFailureKind =
  | "authentication"
  | "forbidden"
  | "permissions"
  | "rate_limit"
  | "unknown";

export interface GitHubPublishOutputTarget {
  outputId: string;
  outputType: GitHubPublishContentType;
  repositoryId: string;
}

export interface RecordGitHubPublishFailureParams extends GitHubPublishOutputTarget {
  organizationId: string;
}

export interface ClearGitHubPublishFailuresParams {
  organizationId: string;
  outputType: GitHubPublishContentType;
  repositoryId: string;
}

export type GitHubPublishRecovery = (
  | { code: "github_authentication_required" }
  | { code: "github_repository_connection_required" }
  | { code: "github_token_authentication_required" }
  | { code: "github_token_permissions_required" }
  | { code: "github_content_publishing_paused" }
  | {
      code: "github_app_permissions_required";
      permissionsUrl?: string;
    }
) & { publishingPaused?: boolean };
export interface UseGitHubRepositorySelectionOptions {
  organizationId: string;
  enabled?: boolean;
  /** Live GitHub catalog. The settings page enables this only while the picker is open. */
  loadCatalog?: boolean;
  refetchOnMount?: boolean;
  initialAccountId?: string | null;
  onSaved: () => void;
}

export type GitHubFormsTranslator = ReturnType<
  typeof useTranslations<"integrations.githubForms">
>;

export type GitHubCallbackErrorMessageKey =
  keyof (typeof messages)["integrations"]["github"]["callbackErrors"];

export interface ContentPullRequestRef {
  owner: string;
  repo: string;
  pullNumber: number;
}

export type ContentPullRequestState =
  | { status: "merged"; mergedAt: Date | null }
  | { status: "closed" }
  | { status: "open"; draft: boolean; nodeId: string };

export interface GitHubReviewProcessProps extends Pick<
  GitHubContentPublishingSettingsProps,
  "organizationId" | "repository" | "contentType" | "disabled"
> {
  config: import("@/types/content/git-publishing").ContentPublishingConfig;
}

export interface GitHubReviewProcessUpdate {
  reviewProcess?: "pull_request" | "direct";
  siteId?: string;
}
export type GitHubMergeMethod = "squash" | "merge" | "rebase";
