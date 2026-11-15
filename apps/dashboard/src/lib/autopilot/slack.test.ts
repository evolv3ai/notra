import { afterAll, beforeEach, expect, spyOn, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

if (process.env.NOTRA_AUTOPILOT_SLACK_TEST !== "1") {
  test("Autopilot Slack sending with synthetic credentials and isolated fetch", () => {
    const child = spawnSync(
      process.execPath,
      ["--no-env-file", "test", fileURLToPath(import.meta.url)],
      {
        env: {
          PATH: process.env.PATH,
          NOTRA_AUTOPILOT_SLACK_TEST: "1",
          INTEGRATION_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
        },
        timeout: 20_000,
      }
    );
    expect(child.status, child.stderr.toString()).toBe(0);
  });
} else {
  const { encryptToken } =
    await import("@notra/db/utils/integration-encryption");
  const { postAutopilotSlackMessage } = await import("./slack");

  const bodies: unknown[] = [];
  const headers: Headers[] = [];
  let reply: () => Response;
  const request = spyOn(globalThis, "fetch").mockImplementation(
    async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      headers.push(new Headers(init?.headers));
      return reply();
    }
  );
  afterAll(() => request.mockRestore());
  beforeEach(() => {
    request.mockClear();
    reply = () =>
      Response.json({
        ok: true,
        channel: "C_SANDBOX",
        ts: "1234567890.000001",
      });
  });

  const input = {
    organizationId: "sandbox",
    encryptedBotToken: encryptToken("fixture-only-token"),
    destination: { teamId: "T_SANDBOX", channelId: "C_SANDBOX" },
    text: "Fixture",
    blocks: [],
    clientMessageId: "12345678-1234-5234-a234-123456789012",
  };

  test("retries reuse the same client message UUID", async () => {
    expect(await postAutopilotSlackMessage(input)).toEqual({
      channel: "C_SANDBOX",
      ts: "1234567890.000001",
      teamId: "T_SANDBOX",
    });
    await postAutopilotSlackMessage(input);
    expect(bodies.at(-1)).toEqual({
      channel: "C_SANDBOX",
      text: "Fixture",
      blocks: [],
      client_msg_id: input.clientMessageId,
    });
    expect(bodies.at(-2)).toEqual(bodies.at(-1));
    expect(headers.at(-1)?.get("authorization")).toBe(
      "Bearer fixture-only-token"
    );
  });

  test("fails closed unless Slack confirms the delivery", async () => {
    reply = () => Response.json({ ok: false, error: "channel_not_found" });
    await expect(postAutopilotSlackMessage(input)).rejects.toMatchObject({
      code: "channel_not_found",
    });
    reply = () => Response.json({ ok: true });
    await expect(postAutopilotSlackMessage(input)).rejects.toMatchObject({
      code: "invalid_response",
    });
    reply = () => new Response("busy", { status: 503 });
    await expect(postAutopilotSlackMessage(input)).rejects.toMatchObject({
      code: "http_503",
    });
    reply = () => new Response("not json");
    await expect(postAutopilotSlackMessage(input)).rejects.toMatchObject({
      code: "invalid_response",
    });
    reply = () => {
      throw new Error("Fixture network unavailable");
    };
    await expect(postAutopilotSlackMessage(input)).rejects.toMatchObject({
      code: "network_error",
    });
    expect(request).toHaveBeenCalledTimes(5);
  });

  test("invalid credentials fail before sending a message", async () => {
    await expect(
      postAutopilotSlackMessage({
        ...input,
        encryptedBotToken: "not-an-encrypted-token",
      })
    ).rejects.toMatchObject({
      _tag: "AutopilotSlackDeliveryError",
      code: "token_error",
      organizationId: input.organizationId,
    });
    expect(request).not.toHaveBeenCalled();
  });
}
