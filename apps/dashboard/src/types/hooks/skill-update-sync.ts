interface SyncedSkillText {
  description: string;
  content: string;
}

export interface UseSkillUpdateSyncOptions {
  organizationId: string;
  name: string;
  reviewedVersion: number | undefined;
  reviewedUpdatedAt: Date | string | undefined;
  onApplied: (skill: SyncedSkillText) => void;
  invalidate: () => void;
}
