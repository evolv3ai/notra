import {
  brandReferences,
  brandSettings,
  chatSessions,
  connectedSocialAccounts,
  geoCompetitors,
  geoPersonas,
  geoPrompts,
  githubIntegrations,
  linearIntegrations,
  posts,
} from "@notra/db/schema";

export const WORKSPACE_SEARCH_COLUMNS = {
  posts: {
    id: posts.id,
    title: posts.title,
    slug: posts.slug,
    status: posts.status,
    updatedAt: posts.updatedAt,
  },
  voices: {
    id: brandSettings.id,
    name: brandSettings.name,
    companyName: brandSettings.companyName,
    websiteUrl: brandSettings.websiteUrl,
    isDefault: brandSettings.isDefault,
  },
  references: {
    id: brandReferences.id,
    voiceId: brandReferences.brandSettingsId,
    type: brandReferences.type,
    content: brandReferences.content,
    note: brandReferences.note,
  },
  githubIntegrations: {
    id: githubIntegrations.id,
    displayName: githubIntegrations.displayName,
    owner: githubIntegrations.owner,
    repo: githubIntegrations.repo,
  },
  linearIntegrations: {
    id: linearIntegrations.id,
    displayName: linearIntegrations.displayName,
    linearOrganizationName: linearIntegrations.linearOrganizationName,
    linearTeamName: linearIntegrations.linearTeamName,
  },
  socialAccounts: {
    id: connectedSocialAccounts.id,
    provider: connectedSocialAccounts.provider,
    username: connectedSocialAccounts.username,
    displayName: connectedSocialAccounts.displayName,
  },
  prompts: {
    id: geoPrompts.id,
    prompt: geoPrompts.prompt,
    title: geoPrompts.title,
    enabled: geoPrompts.enabled,
  },
  competitors: {
    id: geoCompetitors.id,
    name: geoCompetitors.name,
    domain: geoCompetitors.domain,
  },
  personas: {
    id: geoPersonas.id,
    name: geoPersonas.name,
    role: geoPersonas.role,
    company: geoPersonas.company,
  },
  chats: {
    id: chatSessions.id,
    title: chatSessions.title,
    updatedAt: chatSessions.updatedAt,
  },
};
