import { ORPCError } from "@orpc/server";

import { assertAuthenticated } from "@/lib/auth/organization";
import { hasAdminRole } from "@/lib/auth/role";

export async function assertAdmin({ headers }: { headers: Headers }) {
  const { user } = await assertAuthenticated({ headers });

  if (!hasAdminRole(user.role)) {
    throw new ORPCError("FORBIDDEN", {
      message: "Only Notra admins can do this",
    });
  }

  return { user };
}
