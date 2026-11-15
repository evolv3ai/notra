import type { UIMessage } from "ai";

import type {
  ChatLoadingFrame,
  ChatLoadingScenario,
} from "@/types/design-system/chat-loading";

type Part = UIMessage["parts"][number];

const USER_ID = "user-1";
const ASSISTANT_ID = "assistant-1";

function createRecorder(prompt: string) {
  const frames: ChatLoadingFrame[] = [];
  const user: UIMessage = {
    id: USER_ID,
    role: "user",
    parts: [{ type: "text", text: prompt }],
  };
  let assistant: Part[] | null = null;

  function snapshot(delayMs: number, isLoading = true) {
    const messages: UIMessage[] = [user];
    if (assistant) {
      messages.push({
        id: ASSISTANT_ID,
        role: "assistant",
        parts: assistant.map((part) => ({ ...part })) as Part[],
      });
    }
    frames.push({ delayMs, isLoading, messages });
  }

  function parts() {
    assistant ??= [];
    return assistant;
  }

  return {
    frames,
    snapshot,
    stepStart(delayMs: number) {
      parts().push({ type: "step-start" });
      snapshot(delayMs);
    },
    reasoning(text: string, delayMs: number) {
      const list = parts();
      const words = text.split(" ");
      const part = {
        type: "reasoning" as const,
        text: "",
        state: "streaming" as const,
      };
      list.push(part);
      const index = list.length - 1;
      for (let count = 4; count <= words.length + 3; count += 4) {
        list[index] = {
          ...part,
          text: words.slice(0, count).join(" "),
        };
        snapshot(delayMs);
      }
      list[index] = { type: "reasoning", text, state: "done" };
      snapshot(delayMs);
    },
    tool(
      toolName: string,
      input: Record<string, unknown>,
      output: unknown,
      runMs: number
    ) {
      const list = parts();
      const toolCallId = `${toolName}-${String(list.length)}`;
      list.push({
        type: "dynamic-tool",
        toolName,
        toolCallId,
        state: "input-available",
        input,
      });
      const index = list.length - 1;
      snapshot(runMs);
      list[index] = {
        type: "dynamic-tool",
        toolName,
        toolCallId,
        state: "output-available",
        input,
        output,
      };
      snapshot(60);
    },
    text(text: string, chunkMs: number) {
      const list = parts();
      const words = text.split(" ");
      list.push({ type: "text", text: "", state: "streaming" });
      const index = list.length - 1;
      for (let count = 3; count <= words.length + 2; count += 3) {
        list[index] = {
          type: "text",
          text: words.slice(0, count).join(" "),
          state: "streaming",
        };
        snapshot(chunkMs);
      }
      list[index] = { type: "text", text, state: "done" };
      snapshot(chunkMs);
    },
    finish(delayMs: number) {
      snapshot(delayMs, false);
    },
  };
}

const COMMITS_OUTPUT = {
  commits: [
    { sha: "46fd6e3", message: "fix(sites): roll the builder snapshot" },
    { sha: "75bcd46", message: "feat(billing): simplify usage page" },
  ],
};

const ANSWER =
  "Here is a draft for this week's changelog. **Sites** now roll the builder snapshot with every production release, so new deploys never run on a stale image. The **usage page** shows metered quotas only, which makes it much easier to see what you are actually paying for. In **GEO**, the model picker lists only the newest release per model line.";

function toolsScenario(): ChatLoadingScenario {
  const recorder = createRecorder(
    "Write a changelog for this week's shipped work"
  );
  recorder.snapshot(900);
  recorder.stepStart(700);
  recorder.reasoning(
    "The user wants a changelog for this week. I should look at the merged commits first and then check which posts already exist so I don't repeat anything.",
    90
  );
  recorder.stepStart(250);
  recorder.tool(
    "getCommitsByTimeframe",
    { repository: "usenotra/notra", days: 7 },
    COMMITS_OUTPUT,
    1400
  );
  recorder.stepStart(300);
  recorder.tool("getAvailablePosts", { limit: 10 }, { posts: [] }, 700);
  recorder.stepStart(200);
  recorder.tool("getLinearIssues", { state: "done" }, { issues: [] }, 1100);
  recorder.stepStart(900);
  recorder.text(ANSWER, 70);
  recorder.finish(400);
  return {
    id: "tools",
    label: "Tools then answer",
    frames: recorder.frames,
  };
}

function interleavedScenario(): ChatLoadingScenario {
  const recorder = createRecorder("What did we ship in Sites this week?");
  recorder.snapshot(800);
  recorder.stepStart(600);
  recorder.text("Let me check the merged commits for Sites.", 70);
  recorder.stepStart(400);
  recorder.tool(
    "getCommitsByTimeframe",
    { repository: "usenotra/notra", days: 7 },
    COMMITS_OUTPUT,
    1300
  );
  recorder.stepStart(700);
  recorder.text(
    "Two Sites changes landed. The builder snapshot now rolls with every production release, and the deployment status updates live through realtime instead of polling.",
    70
  );
  recorder.finish(400);
  return {
    id: "interleaved",
    label: "Text between tools",
    frames: recorder.frames,
  };
}

function directScenario(): ChatLoadingScenario {
  const recorder = createRecorder("Give me three title ideas for the post");
  recorder.snapshot(1400);
  recorder.stepStart(500);
  recorder.text(
    "1. Faster deploys with rolling builder snapshots\n2. Usage that reads like a bill\n3. One model per line in the GEO picker",
    80
  );
  recorder.finish(400);
  return {
    id: "direct",
    label: "Direct answer",
    frames: recorder.frames,
  };
}

export function buildChatLoadingScenarios(): ChatLoadingScenario[] {
  return [toolsScenario(), interleavedScenario(), directScenario()];
}
