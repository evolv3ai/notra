import type { postVersions } from "@notra/db/schema";

export type ContentHistoryRow = Pick<
  typeof postVersions.$inferSelect,
  | "id"
  | "revision"
  | "title"
  | "createdAt"
  | "source"
  | "actorUserId"
  | "retained"
> & { actorName: string | null };

export type ContentHistoryListRow = ContentHistoryRow &
  Pick<typeof postVersions.$inferSelect, "slug" | "metadata"> & {
    markdownHash: string;
  };
