import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";

import type {
  ExperimentalSlackActivitySnapshot,
  SlackInteractionAction,
} from "eve/channels/slack";

import {
  SLACK_CONTROLS_METADATA_TYPE,
  SLACK_LEAVE_ACTION_ID,
  SLACK_STOP_ACTION_ID,
} from "../agent/lib/constants/slack-controls";
import type { SlackControlContext } from "../agent/lib/types/slack-controls";
import {
  buildSlackControlsPost,
  createSlackControlsRenderer,
  handleSlackControl,
  handleSlackControlAction,
  parseSlackControlMessage,
} from "../agent/lib/utils/slack-controls";
import { withToolActivityLabel } from "../agent/lib/utils/tool-activity";

afterEach(() => mock.restore());

function controlContext() {
  const session = {
    id: "session-1",
    cancel: mock(async () => ({
      status: "accepted" as const,
      sessionId: "session-1",
    })),
    reset: mock(async () => ({
      status: "reset" as const,
      previousSessionId: "session-1",
    })),
  };
  const thread = {
    post: mock(async () => ({ id: "message-1", raw: { ok: true } })),
    startTyping: mock(async () => undefined),
  };
  const ctx = {
    thread,
    resolveSession: mock(async () => session),
  } satisfies SlackControlContext;
  return { ctx, session };
}

const rootWork = {
  id: "turn-1",
  kind: "root-turn",
  phase: "running",
  rootSessionId: "session-1",
  rootTurnId: "turn-1",
  startedAt: "2026-10-13T09:00:00Z",
} as const;

const snapshot: ExperimentalSlackActivitySnapshot = {
  version: 1,
  revision: 1,
  actions: {},
  blockers: {},
  pendingSettlements: {},
  seenEventIds: [],
  work: {
    "turn-1": rootWork,
  },
};

const destination = {
  channelId: "channel-1",
  threadTs: "123.456",
  installationTeamId: "team-1",
  teamId: "team-1",
  triggeringUserId: "user-1",
};

describe("Slack thread controls", () => {
  test("recognizes only whole commands, including mentions and German aliases", () => {
    for (const text of [
      "stop",
      "STOP!",
      "stopp",
      "<@U123> stop",
      "@Notra: cancel",
    ]) {
      expect(parseSlackControlMessage(text, true)).toBe("stop");
    }
    for (const text of [
      "stop replying",
      "<@U123> leave this thread.",
      "nicht mehr antworten",
    ]) {
      expect(parseSlackControlMessage(text, true)).toBe("leave");
    }
    for (const text of [
      "write a post about stop buttons",
      "stop changing the headline",
      "please explain unsubscribe",
    ]) {
      expect(parseSlackControlMessage(text)).toBeNull();
    }
    expect(parseSlackControlMessage("<@OTHER> stop", false)).toBeNull();
    expect(parseSlackControlMessage("stop", false)).toBe("stop");
  });

  test("stops the pinned turn and its tasks without starting another turn", async () => {
    const { ctx, session } = controlContext();
    await handleSlackControl("stop", ctx, {
      sessionId: session.id,
      turnId: "turn-1",
    });
    expect(session.cancel).toHaveBeenCalledWith({
      tasks: true,
      turnId: "turn-1",
    });
    expect(session.reset).not.toHaveBeenCalled();
    expect(ctx.thread.post).toHaveBeenCalledWith(
      expect.stringContaining("doesn't undo")
    );
  });

  test("leaving retires the thread session and clears typing", async () => {
    const { ctx, session } = controlContext();
    await handleSlackControl("leave", ctx);
    expect(session.reset).toHaveBeenCalledTimes(1);
    expect(session.cancel).not.toHaveBeenCalled();
    expect(ctx.thread.startTyping).not.toHaveBeenCalled();
    expect(ctx.thread.post).toHaveBeenCalledWith(
      expect.stringContaining("Mention @Notra")
    );
  });

  test("an old card cannot stop or retire a replacement session", async () => {
    const { ctx, session } = controlContext();
    for (const control of ["stop", "leave"] as const) {
      await handleSlackControl(control, ctx, {
        sessionId: "old-session",
        turnId: "old-turn",
      });
    }
    expect(session.cancel).not.toHaveBeenCalled();
    expect(session.reset).not.toHaveBeenCalled();
  });

  test("malformed and unrelated interactions cannot cancel a session", async () => {
    const { ctx, session } = controlContext();
    for (const value of [
      undefined,
      "not-json",
      "{}",
      '{"sessionId":"session-1"}',
    ]) {
      await handleSlackControlAction(
        { actionId: SLACK_STOP_ACTION_ID, value, user: { id: "user-1" } },
        ctx
      );
    }
    await handleSlackControlAction(
      {
        actionId: "unrelated",
        value: JSON.stringify({ sessionId: session.id, turnId: "turn-1" }),
        user: { id: "user-1" },
      },
      ctx
    );
    expect(session.cancel).not.toHaveBeenCalled();
    expect(ctx.resolveSession).not.toHaveBeenCalled();
  });

  test("valid button values are bound to their session and turn", async () => {
    const { ctx, session } = controlContext();
    const action: SlackInteractionAction = {
      actionId: SLACK_STOP_ACTION_ID,
      value: JSON.stringify({ sessionId: session.id, turnId: "turn-1" }),
      user: { id: "user-1" },
    };
    await handleSlackControlAction(action, ctx);
    expect(session.cancel).toHaveBeenCalledWith({
      tasks: true,
      turnId: "turn-1",
    });
  });

  test("only running requests get a stop button", () => {
    expect(
      JSON.stringify(buildSlackControlsPost("session-1", "turn-1", "working"))
    ).toContain(SLACK_STOP_ACTION_ID);
    for (const phase of ["waiting", "idle"] as const) {
      const card = JSON.stringify(
        buildSlackControlsPost("session-1", "turn-1", phase)
      );
      expect(card).not.toContain(SLACK_STOP_ACTION_ID);
      expect(card).toContain(SLACK_LEAVE_ACTION_ID);
    }
  });

  test("activity updates reuse one card and duplicate snapshots do not post twice", async () => {
    const fetchMock = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ ok: true, messages: [] }))
      .mockResolvedValueOnce(Response.json({ ok: true, ts: "123.789" }))
      .mockResolvedValueOnce(Response.json({ ok: true, ts: "123.789" }));
    const renderer = createSlackControlsRenderer("test-bot-token");
    const first = await renderer.render({
      destination,
      snapshot,
      state: undefined,
    });
    await renderer.render({ destination, snapshot, state: first });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const finished = {
      ...snapshot,
      revision: 2,
      work: {
        "turn-1": { ...rootWork, phase: "completed" as const },
      },
    };
    await renderer.render({ destination, snapshot: finished, state: first });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain("chat.update");
    expect(String(fetchMock.mock.calls[2]?.[1]?.body)).not.toContain(
      SLACK_STOP_ACTION_ID
    );
  });

  test("controls are not posted without a thread destination", async () => {
    const fetchMock = spyOn(globalThis, "fetch");
    await createSlackControlsRenderer("test-bot-token").render({
      destination: { ...destination, threadTs: null },
      snapshot,
      state: undefined,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("a deleted control card is replaced once instead of blocking future controls", async () => {
    const fetchMock = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({ ok: false, error: "message_not_found" })
      )
      .mockResolvedValueOnce(Response.json({ ok: true, messages: [] }))
      .mockResolvedValueOnce(Response.json({ ok: true, ts: "new-message" }));
    const state = await createSlackControlsRenderer("test-bot-token").render({
      destination,
      snapshot,
      state: {
        sessionId: "session-1",
        messageTs: "deleted-message",
        text: "Notra thread controls.",
        turnId: "turn-1",
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("chat.update");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      "conversations.replies"
    );
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain("chat.postMessage");
    expect(state?.messageTs).toBe("new-message");
  });

  test("a later completed question does not hide controls for earlier delegated work", async () => {
    const fetchMock = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({ ok: true, ts: "card-1" })
    );
    const ongoing: ExperimentalSlackActivitySnapshot = {
      ...snapshot,
      work: {
        "turn-1": rootWork,
        "turn-2": {
          ...rootWork,
          id: "turn-2",
          rootTurnId: "turn-2",
          phase: "completed",
          startedAt: "2026-10-13T09:01:00Z",
        },
        image: {
          ...rootWork,
          id: "image",
          kind: "subagent",
          parentId: rootWork.id,
          name: "image-designer",
          startedAt: "2026-10-13T09:00:01Z",
        },
      },
    };
    const state = await createSlackControlsRenderer("test-bot-token").render({
      destination,
      snapshot: ongoing,
      state: {
        sessionId: "session-1",
        messageTs: "card-1",
        text: "Notra thread controls.",
        turnId: "turn-2",
      },
    });
    expect(state?.turnId).toBe("turn-1");
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain(
      SLACK_STOP_ACTION_ID
    );
  });

  test("a lost initial post response is recovered rather than posted twice", async () => {
    const fetchMock = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ ok: true, messages: [] }))
      .mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValueOnce(
        Response.json({
          ok: true,
          messages: [
            {
              ts: "committed-card",
              metadata: {
                event_type: SLACK_CONTROLS_METADATA_TYPE,
                event_payload: { session_id: "session-1" },
              },
            },
          ],
        })
      )
      .mockResolvedValueOnce(Response.json({ ok: true, ts: "committed-card" }));
    const renderer = createSlackControlsRenderer("test-bot-token");
    await expect(
      renderer.render({ destination, snapshot, state: undefined })
    ).rejects.toThrow("response lost");
    const state = await renderer.render({
      destination,
      snapshot,
      state: undefined,
    });
    expect(state?.messageTs).toBe("committed-card");
    expect(
      fetchMock.mock.calls.filter((call) =>
        String(call[0]).includes("chat.postMessage")
      )
    ).toHaveLength(1);
    expect(String(fetchMock.mock.calls[3]?.[0])).toContain("chat.update");
  });

  test("a lost replacement response recovers the replacement, not another card", async () => {
    const fetchMock = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({ ok: false, error: "message_not_found" })
      )
      .mockResolvedValueOnce(Response.json({ ok: true, messages: [] }))
      .mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValueOnce(
        Response.json({ ok: false, error: "message_not_found" })
      )
      .mockResolvedValueOnce(
        Response.json({
          ok: true,
          messages: [
            {
              ts: "replacement-card",
              metadata: {
                event_type: SLACK_CONTROLS_METADATA_TYPE,
                event_payload: { session_id: "session-1" },
              },
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        Response.json({ ok: true, ts: "replacement-card" })
      );
    const renderer = createSlackControlsRenderer("test-bot-token");
    const oldState = {
      sessionId: "session-1",
      messageTs: "deleted-card",
      text: "Notra thread controls.",
      turnId: "turn-1",
    };
    await expect(
      renderer.render({ destination, snapshot, state: oldState })
    ).rejects.toThrow("response lost");
    const recovered = await renderer.render({
      destination,
      snapshot,
      state: oldState,
    });
    expect(recovered?.messageTs).toBe("replacement-card");
    expect(
      fetchMock.mock.calls.filter((call) =>
        String(call[0]).includes("chat.postMessage")
      )
    ).toHaveLength(1);
  });

  test("a failed recovery does not blindly post another card", async () => {
    const fetchMock = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({ ok: false, error: "ratelimited" })
    );
    await expect(
      createSlackControlsRenderer("test-bot-token").render({
        destination,
        snapshot,
        state: undefined,
      })
    ).rejects.toThrow("recovery failed");
    expect(
      fetchMock.mock.calls.filter((call) =>
        String(call[0]).includes("chat.postMessage")
      )
    ).toHaveLength(0);
  });

  test("retiring a session removes stale working text and interactive controls", async () => {
    const fetchMock = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({ ok: true })
    );
    await createSlackControlsRenderer("test-bot-token").dispose?.({
      destination,
      state: {
        sessionId: "session-1",
        messageTs: "card-1",
        text: "Notra is working in this thread.",
        turnId: "turn-1",
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = new URLSearchParams(
      String(fetchMock.mock.calls[0]?.[1]?.body)
    );
    expect(body.get("text")).toContain("no longer replying");
    expect(body.get("blocks")).toBe("[]");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("chat.update");
  });

  test("retirement recovers an untracked card without touching a replacement session", async () => {
    const fetchMock = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          ok: true,
          messages: [
            {
              ts: "replacement-card",
              metadata: {
                event_type: SLACK_CONTROLS_METADATA_TYPE,
                event_payload: { session_id: "new-session" },
              },
            },
            {
              ts: "old-card",
              metadata: {
                event_type: SLACK_CONTROLS_METADATA_TYPE,
                event_payload: { session_id: "session-1" },
              },
            },
          ],
        })
      )
      .mockResolvedValueOnce(Response.json({ ok: true }));
    await createSlackControlsRenderer("test-bot-token").dispose?.({
      destination,
      snapshot,
      state: undefined,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body = new URLSearchParams(
      String(fetchMock.mock.calls[1]?.[1]?.body)
    );
    expect(body.get("ts")).toBe("old-card");
    expect(body.get("blocks")).toBe("[]");
  });

  test("activity labels retain non-enumerable tool identity metadata", () => {
    const tool = { description: "Read issues" };
    const key = Symbol.for("eve.definition-source-key");
    Object.defineProperty(tool, key, { value: "source-1" });
    const labelled = withToolActivityLabel(tool, "Reading Linear issues");
    expect(Object.is(labelled, tool)).toBe(true);
    expect(Reflect.get(labelled, key)).toBe("source-1");
    expect(labelled.label.start()).toBe("Reading Linear issues");
  });
});
