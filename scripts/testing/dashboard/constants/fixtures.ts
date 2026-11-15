export const DASHBOARD_SITE_FIXTURES = [
  {
    organizationId: "sites-e2e-acme",
    slug: "sites-e2e-acme",
    name: "Acme E2E",
    userId: "sites-e2e-owner",
    email: "sites-e2e-owner@example.test",
    role: "owner",
  },
  {
    organizationId: "sites-e2e-other",
    slug: "sites-e2e-other",
    name: "Other E2E tenant",
    userId: "sites-e2e-outsider",
    email: "sites-e2e-outsider@example.test",
    role: "member",
  },
] as const;
