export interface SiteSuspendedEmailProps {
  organizationName: string;
  /** A single site, or every site of the workspace. */
  scope: "site" | "workspace";
  siteNames: string[];
  categoryLabel: string;
  reason: string;
  appealEmail: string;
}
