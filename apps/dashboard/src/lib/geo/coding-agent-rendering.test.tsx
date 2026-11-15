import { describe, expect, test } from "bun:test";

import {
  GEO_CHAT_SKIN_SURFACE,
  GEO_CLAUDE_CODE_ENGINE_IDS,
  GEO_CODEX_ENGINE_IDS,
  GEO_OPENCODE_ENGINE_ID,
} from "@notra/geo-core/constants/geo";
import { GeoPromptAnswerThread } from "@notra/ui/components/geo/geo-prompt-answer-thread";
import { geoChatSkin } from "@notra/ui/lib/geo-chat-skin";
import { renderToStaticMarkup } from "react-dom/server";

describe("GEO answer theme scoping", () => {
  test.each([
    GEO_CLAUDE_CODE_ENGINE_IDS[0],
    GEO_CODEX_ENGINE_IDS[0],
    GEO_OPENCODE_ENGINE_ID,
  ])("scopes dark tokens and readable foreground locally for %s", (engine) => {
    const surface = GEO_CHAT_SKIN_SURFACE[geoChatSkin(engine)].split(" ");
    expect(surface).toContain("dark");
    expect(surface).toContain("text-foreground");
    expect(surface).toContain("scheme-dark");
    const html = renderToStaticMarkup(
      <GeoPromptAnswerThread
        result={{ engine, excerpt: "A readable answer", mentioned: true }}
        prompt="A question"
        timestamp="2026-10-14T00:00:00Z"
      />
    );
    const rootClass = html.match(/<div class="([^"]+)"/u)?.[1] ?? "";
    expect(rootClass.split(" ")).toContain("dark");
    expect(rootClass.split(" ")).toContain("text-foreground");
    expect(rootClass.split(" ")).toContain("scheme-dark");
  });

  test.each([
    "openai/gpt-6-astra",
    "anthropic/claude-opus-5",
    "google/gemini-3.8-flash",
    "perplexity/sonar",
  ])("does not force a dark theme on the chat skin for %s", (engine) => {
    const html = renderToStaticMarkup(
      <GeoPromptAnswerThread
        result={{ engine, excerpt: "A readable answer", mentioned: true }}
        prompt="A question"
        timestamp="2026-10-14T00:00:00Z"
      />
    );
    const rootClass = html.match(/<div class="([^"]+)"/u)?.[1] ?? "";
    for (const classes of [
      GEO_CHAT_SKIN_SURFACE[geoChatSkin(engine)],
      rootClass,
    ]) {
      expect(classes.split(" ")).not.toContain("dark");
      expect(classes.split(" ")).not.toContain("scheme-dark");
    }
  });
});
