import {
  defaultSlackAuth,
  type SlackContext,
  type SlackMessage,
} from "eve/channels/slack";

import type { ResolvedSlackInstallation } from "../types/slack";

function getSenderTeamId(message: SlackMessage): string | undefined {
  const { user_team: userTeam, team } = message.raw;
  if (typeof userTeam === "string" && userTeam.length > 0) {
    return userTeam;
  }
  return typeof team === "string" && team.length > 0 ? team : undefined;
}

export function buildNotraSlackAuth(
  ctx: SlackContext,
  message: SlackMessage,
  installation: ResolvedSlackInstallation
) {
  const senderTeamId = getSenderTeamId(message);
  if (senderTeamId && senderTeamId !== installation.teamId) {
    return null;
  }

  const auth = defaultSlackAuth(message, ctx);
  if (!auth) {
    return null;
  }

  return {
    ...auth,
    attributes: {
      ...auth.attributes,
      organizationId: installation.organizationId,
      surface: "standalone-chat",
    },
  };
}
