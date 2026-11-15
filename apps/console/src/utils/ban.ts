import type { BannedStatusUser } from "@/types/auth";

/** A ban counts until it expires. */
export function isUserBanned(user: BannedStatusUser) {
  if (!user.banned) {
    return false;
  }
  return !user.banExpires || user.banExpires > new Date();
}
