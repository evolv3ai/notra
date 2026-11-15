import { expect, mock, test } from "bun:test";

const installations = [
  {
    slackTeamId: "T-one",
    organizationId: "org-one",
    enabled: true,
    allowedChannelIds: null,
    botToken: "fixture-one",
  },
  {
    slackTeamId: "T-two",
    organizationId: "org-two",
    enabled: true,
    allowedChannelIds: null,
    botToken: "fixture-two",
  },
  {
    slackTeamId: "T-disabled",
    organizationId: "org-disabled",
    enabled: false,
    allowedChannelIds: null,
    botToken: "fixture-disabled",
  },
];

mock.module("@notra/ai/integrations/slack-workspace", () => ({
  getEnabledSlackIntegrations: async () =>
    installations.filter((row) => row.enabled),
  getSlackIntegrationByTeamId: async (teamId: string) =>
    installations.find((row) => row.slackTeamId === teamId) ?? null,
  getSlackIntegrationBotToken: (row: (typeof installations)[number]) =>
    row.botToken,
}));

mock.module("@notra/db/drizzle", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => [{ slug: "example" }] }),
      }),
    }),
  },
}));
mock.module("@notra/db/schema", () => ({
  organizations: { id: "organization_id" },
}));

const { resolveSlackOutboundBotToken, runWithSlackTeam } =
  await import("../agent/lib/utils/slack-installation");

test("Slack credentials use the installation workspace, not a global default", async () => {
  expect(await resolveSlackOutboundBotToken("T-one")).toBe("fixture-one");
  expect(await resolveSlackOutboundBotToken("T-two")).toBe("fixture-two");
});

test("explicit workspace selection overrides another handler's installation context", async () => {
  const token = await runWithSlackTeam("T-one", () =>
    resolveSlackOutboundBotToken("T-two")
  );
  expect(token).toBe("fixture-two");
});

test("unknown and disabled workspaces cannot borrow another installation's token", async () => {
  for (const teamId of ["T-missing", "T-disabled"]) {
    await expect(resolveSlackOutboundBotToken(teamId)).rejects.toThrow(
      "No enabled Slack installation"
    );
  }
});
