import type { ReactNode } from "react";

import type { consoleOrpcClient } from "@/lib/orpc/client";

export type SystemSkillDetail = Awaited<
  ReturnType<typeof consoleOrpcClient.skills.get>
>;

export interface SystemSkillsPageProps {
  slug: string;
}

export interface SystemSkillEditorPageProps extends SystemSkillsPageProps {
  name: string | null;
}

export interface SystemSkillsRouteProps {
  params: Promise<{ slug: string }>;
}

export interface SystemSkillRouteProps {
  params: Promise<{ slug: string; name: string }>;
}

export interface DiffSectionProps {
  label: string;
  children: ReactNode;
}

type SystemSkillVersion = SystemSkillDetail["versions"][number];

export interface SystemSkillHeaderProps {
  slug: string;
  skill: SystemSkillDetail | null;
  hasChanges: boolean;
  pending: boolean;
  nextVersion: number;
  onDiscard: () => void;
  onPublish: () => void;
}

export interface SystemSkillCodeAlertProps {
  version: number;
  onLoad: () => void;
}

export interface SystemSkillVersionsProps {
  skill: SystemSkillDetail;
  onLoad: (version: SystemSkillVersion) => void;
}

export interface UsePublishSystemSkillOptions {
  slug: string;
  baseVersion: number | null;
  draft: { name: string; description: string; content: string; note: string };
  onSettled: () => void;
}

export interface SystemSkillContentFieldProps {
  skill: SystemSkillDetail | null;
  view: string;
  description: string;
  content: string;
  onViewChange: (view: string) => void;
  onContentChange: (content: string) => void;
}
