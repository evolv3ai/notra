import type {
  ClientSessionData,
  SessionInfo,
  SessionUser,
} from "@/types/auth/session";

/** The session shape `/api/session` returns, minus anything private to the server. */
export function toClientSessionData(
  session: SessionInfo,
  user: SessionUser
): ClientSessionData {
  return {
    session,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      role: user.role,
      hidePersonalData: user.hidePersonalData,
      showAgentStats: user.showAgentStats,
      locale: user.locale,
      createdAt: user.createdAt,
    },
  };
}
