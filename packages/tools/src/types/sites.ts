import type { sites } from "@notra/db/schema";

import type { PUBLIC_SITE_COLUMNS } from "../constants/sites";

export type PublicSite = Pick<
  typeof sites.$inferSelect,
  keyof typeof PUBLIC_SITE_COLUMNS
>;
