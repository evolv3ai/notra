import type { users } from "@notra/db/schema";
import type { PendingAuthStep } from "@notra/schemas/types/dashboard/auth";
import type { CSSProperties } from "react";

type SessionUser = typeof users.$inferSelect;

interface SessionInfo {
  userId: string;
  activeOrganizationId: string | null;
  impersonatedBy: string | null;
}

export interface AuthSessionData {
  session: SessionInfo;
  user: SessionUser;
}

export interface ClientSessionData {
  session: SessionInfo;
  user: Pick<
    SessionUser,
    | "id"
    | "name"
    | "email"
    | "emailVerified"
    | "image"
    | "role"
    | "hidePersonalData"
    | "showAgentStats"
  > & { createdAt: string };
}

export interface SignOutOptions {
  fetchOptions?: {
    onSuccess?: () => void;
  };
}

export interface ConsoleUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface ImpersonationUser extends ConsoleUser {
  role: string | null;
  banned: boolean | null;
}

export interface BannedStatusUser {
  banned: boolean | null;
  banExpires: Date | null;
}

export interface ListUsersInput {
  search?: string;
}

export interface GetServerSessionParams {
  headers: Headers;
}

export interface UserImpersonationDialogProps {
  currentUserId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export interface ImpersonationBannerProps {
  email: string;
  name: string;
}

export interface ImpersonationBannerStyle extends CSSProperties {
  "--impersonation-banner-height": string;
}

export interface UserMenuProps {
  isAdmin: boolean;
  user: ConsoleUser;
}

export interface ConsoleLoginFormProps {
  returnTo?: string;
  initialError?: string;
  initialPending?: PendingAuthStep;
}

export interface ConsoleSocialAttempt {
  codeVerifier: string;
  returnTo: string | null;
}

export interface ConsolePendingAuthContext {
  identifier: string;
  email: string;
}

export interface SignOutActionOptions {
  returnTo?: string;
}
