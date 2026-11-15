export interface PurgeSocialAccountInput {
  organizationId: string;
  provider: string;
  providerAccountId: string;
}

export interface PurgeGeoProjectInput {
  organizationId: string;
  projectId: string;
}

export interface PurgeOrganizationInput {
  organizationId: string;
}

export interface PurgeSiteInput {
  organizationId: string;
  siteId: string;
}

export type DeletedAnalyticsPurgeInput = {
  organizationId: string;
  siteId?: string;
  projectId?: string;
};
