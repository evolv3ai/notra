interface SwitcherProject {
  id: string;
  name: string;
  brandSettingsId: string;
}

export interface ProjectSwitcherTriggerProps {
  project: Pick<SwitcherProject, "name"> | undefined;
  domain: string | null;
  isLoading: boolean;
  logo?: string | null;
  logoDomain?: string | null;
  logoName?: string;
}

export interface ProjectMenuListProps {
  projects: SwitcherProject[];
  activeProjectId: string | undefined;
  projectDomain: (brandSettingsId: string) => string | null;
  onSwitch: (projectId: string) => void;
}
