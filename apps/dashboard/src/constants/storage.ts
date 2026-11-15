const CHAT_PREFERENCES_STORAGE_VERSION = "v1";

export const localStorageKeys = {
  chatPreferences: `notra_chat_preferences:${CHAT_PREFERENCES_STORAGE_VERSION}`,
  chatQueue: (chatId: string, userId: string) =>
    `chat-queue:${userId}:${chatId}`,
  chatDraft: (draftId: string) => `chat-draft:${draftId}`,
  imageExportTarget: "notra:image-export-target",
  contentView: "notra:content-view",
  contentPanelClosed: "notra:content-panel-closed",
  sidebarMode: "notra:sidebar-mode:v1",
  sidebarOnboardingCollapsed: (organizationId?: string) =>
    organizationId
      ? `onboarding-collapsed:${organizationId}`
      : "onboarding-collapsed",
  brandIdentity: (organizationId: string) =>
    `notra:brand-identity:v1:${organizationId}`,
  onboardingAgentBannerDismissed: (organizationId: string) =>
    `notra:eve-banner-dismissed:${organizationId}`,
  geoUpgradeDismissed: (organizationId: string) =>
    `notra:geo-upgrade-dismissed:${organizationId}`,
  chatSuggestionsDismissed: "notra:chat-suggestions-dismissed:v1",
  dashboardAgentSuggestionsDismissed:
    "notra:dashboard-agent-suggestions-dismissed:v2",
  commandPaletteRecents: (organizationId: string) =>
    `notra:command-palette-recents:v1:${organizationId}`,
  githubPublishRepository: (organizationId: string) =>
    `notra:github-publish-repository:v1:${organizationId}`,
  welcomeTourSeen: "notra:welcome-tour-seen",
  connectAgentDismissed: "notra:connect-agent-dismissed:v1",
} as const;

export const sessionStorageKeys = {
  marketingAttribution: "notra_marketing_signup_attribution",
  toastDedupe: "notra:deduped-toasts",
} as const;
