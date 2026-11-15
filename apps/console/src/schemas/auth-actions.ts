// biome-ignore lint/performance/noNamespaceImport: Zod recommended way to import
import * as z from "zod";

const RETURN_TO_MAX_LENGTH = 2048;
const USER_SEARCH_MAX_LENGTH = 100;

export const signOutOptionsSchema = z
  .object({
    returnTo: z.string().min(1).max(RETURN_TO_MAX_LENGTH).optional(),
  })
  .optional();

export const listUsersInputSchema = z
  .object({
    search: z.string().trim().max(USER_SEARCH_MAX_LENGTH).optional(),
  })
  .optional();
