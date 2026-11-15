import { db } from "@notra/db/drizzle";
import { users } from "@notra/db/schema";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { eq } from "drizzle-orm";
import { unstable_rethrow } from "next/navigation";

import { isUserBanned } from "@/utils/ban";

export async function isSessionBanned(): Promise<boolean> {
  try {
    const { user } = await withAuth();

    if (!user) {
      return false;
    }

    const localUser = await db.query.users.findFirst({
      where: eq(users.workosUserId, user.id),
      columns: { banned: true, banExpires: true },
    });

    return localUser ? isUserBanned(localUser) : false;
  } catch (error) {
    unstable_rethrow(error);
    return false;
  }
}
