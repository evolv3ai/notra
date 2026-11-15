import type { GitHubConnectionMethod } from "@notra/ai/types/github-connection";
import type React from "react";
import type { useTranslations } from "use-intl";

export type IntegrationsSharedTranslator = ReturnType<
  typeof useTranslations<"integrations.shared">
>;

export interface RepositoryOutput {
  id: string;
  outputType: string;
  enabled: boolean;
}

export interface GitHubRepository {
  id: string;
  owner: string;
  repo: string;
  defaultBranch: string | null;
  enabled: boolean;
  hasWebhook?: boolean;
  outputs?: RepositoryOutput[];
}

export interface GitHubIntegration {
  id: string;
  connectionMethod?: GitHubConnectionMethod;
  displayName: string;
  enabled: boolean;
  managedByGitHubApp: boolean;
  createdAt: string;
  createdByUser?: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
  repositories: GitHubRepository[];
}

export interface SlackIntegration {
  id: string;
  displayName: string;
  enabled: boolean;
  createdAt: string;
  slackTeamId: string;
  slackTeamName?: string | null;
  allowedChannelIds: string[] | null;
  notificationChannelId: string | null;
  createdByUser?: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

export interface LinearIntegration {
  id: string;
  displayName: string;
  enabled: boolean;
  createdAt: string;
  linearOrganizationId?: string;
  linearOrganizationName?: string | null;
  linearTeamId?: string | null;
  linearTeamName?: string | null;
  createdByUser?: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

interface GranolaIntegration {
  id: string;
  displayName: string;
  enabled: boolean;
  createdAt: string;
  workspaceName?: string | null;
  createdByUser?: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

export interface AddGranolaIntegrationDialogProps {
  organizationId: string;
  onSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export interface GranolaIntegrationCardProps {
  integration: GranolaIntegration;
  organizationId: string;
  onUpdate?: () => void;
}

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  fullUrl: string;
}

export interface AvailableRepo {
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  description: string | null;
  url: string;
}

export interface AddIntegrationDialogProps {
  organizationId?: string;
  organizationSlug?: string;
  onSuccess?: () => void;
  onFlowComplete?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export interface AddRepositoryDialogProps {
  integrationId: string;
  organizationId: string;
  onSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export interface EditTokenDialogProps {
  integration: GitHubIntegration;
  organizationId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export interface IntegrationCardProps {
  integration: GitHubIntegration;
  organizationId: string;
  organizationSlug: string;
  onUpdate?: () => void;
}

export interface IntegrationCardDitherProps {
  active: boolean;
  color: string;
}

type DitherInteractionProps = Pick<
  React.HTMLAttributes<HTMLElement>,
  "onBlur" | "onFocus" | "onPointerEnter" | "onPointerLeave"
>;

export interface IntegrationCardDitherInteraction {
  active: boolean;
  interactionProps: DitherInteractionProps;
}

export interface WebhookSetupDialogProps {
  repositoryId: string;
  organizationId: string;
  owner: string;
  repo: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}
