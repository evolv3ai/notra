import { boolean, object, string } from "zod";

export const geoContextResponseSchema = object({
  url: string().url(),
  request_id: string().min(1).max(200),
  html: object({
    requested: boolean(),
    success: boolean().nullable(),
    data: string().nullable(),
  }),
});
