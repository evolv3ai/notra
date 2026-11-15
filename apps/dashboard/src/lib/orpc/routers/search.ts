import { globalSearchInputSchema } from "@notra/schemas/dashboard/search";

import { baseProcedure, withOrganizationAccess } from "@/lib/orpc/base";
import { searchWorkspace } from "@/lib/search/workspace-search";

export const searchRouter = {
  global: baseProcedure
    .input(globalSearchInputSchema)
    .use(withOrganizationAccess)
    .handler(({ input }) => searchWorkspace(input)),
};
