import type { organizations } from "@notra/db/schema";

export type OrganizationResponse = Pick<
  typeof organizations.$inferSelect,
  "id" | "slug" | "name" | "logo"
>;
