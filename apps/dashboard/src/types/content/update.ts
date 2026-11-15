import type {
  ContentResponse,
  UpdateContentInput,
} from "@notra/schemas/dashboard/content";

export type ContentUpdatePost = Pick<ContentResponse, "title" | "status">;

export type ContentUpdateDataInput = Pick<
  UpdateContentInput,
  "markdown" | "status" | "title" | "socialVideo"
>;
