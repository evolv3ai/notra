export interface SkillSummary {
  name: string;
  description: string;
}

export interface SkillContent extends SkillSummary {
  content: string;
}

export interface CreateSkillInput {
  name: string;
  description: string;
  content: string;
}

export interface SkillServiceContext {
  organizationId: string;
}

export interface ListSkillsOptions {
  limit?: number;
  offset?: number;
}

export interface SystemSkillDefinition {
  name: string;
  description: string;
  content: string;
}

export interface PublishSystemSkillInput extends SystemSkillDefinition {
  expectedVersion: number | null;
  note?: string | null;
  publishedByUserId?: string | null;
}

export interface PublishSystemSkillResult {
  id: string;
  version: number;
  updatedCopies: number;
  addedCopies: number;
}

export interface SkillUpstreamStatus {
  version: number;
  latestVersion: number;
  customized: boolean;
}

export interface SkillUpstreamDetail extends SkillUpstreamStatus {
  latest: {
    description: string;
    content: string;
    note: string | null;
    publishedAt: Date;
  };
}

export interface SystemSkillAdoption {
  copies: number;
  onLatest: number;
  customized: number;
}

export interface SyncSkillToLatestInput {
  keepCustomizations: boolean;
  reviewedVersion: number;
  reviewedUpdatedAt: Date;
}

export type SyncSkillToLatestResult =
  | {
      status: "synced";
      skill: { description: string; content: string; updatedAt: Date };
    }
  | { status: "conflict" }
  | { status: "not_found" };
