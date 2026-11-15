import { createServerFn } from "@tanstack/react-start";

import type { SignOutActionOptions } from "@/types/auth/user-actions";

import { signOut } from "./user-actions";

const signOutServerFn = createServerFn({ method: "POST" })
  .validator((data: SignOutActionOptions | undefined) => data)
  .handler(({ data }) => signOut(data));

export const signOutAction = (options?: SignOutActionOptions) =>
  signOutServerFn({ data: options });
