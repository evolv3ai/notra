import { describe, expect, test } from "bun:test";

import { collapseUnchanged, diffLines } from "@notra/ui/lib/line-diff";

describe("diffLines", () => {
  test("marks changed lines and keeps shared ones", () => {
    expect(
      diffLines("a\nb\nc", "a\nx\nc").map(({ type, text }) => ({ type, text }))
    ).toEqual([
      { type: "same", text: "a" },
      { type: "removed", text: "b" },
      { type: "added", text: "x" },
      { type: "same", text: "c" },
    ]);
  });

  test("folds unchanged runs away from changes", () => {
    const before = Array.from({ length: 20 }, (_, i) => `line ${i}`).join("\n");
    const after = before.replace("line 19", "changed");
    const rows = collapseUnchanged(diffLines(before, after));
    expect(rows[0]).toMatchObject({ type: "collapsed", count: 16 });
    expect(rows.at(-1)).toMatchObject({ type: "added", text: "changed" });
  });

  test("stays bounded for huge rewrites", () => {
    const before = Array.from({ length: 20_000 }, (_, i) => `a${i}`).join("\n");
    const after = Array.from({ length: 20_000 }, (_, i) => `b${i}`).join("\n");
    const lines = diffLines(`head\n${before}\ntail`, `head\n${after}\ntail`);
    expect(lines).toHaveLength(40_002);
    expect(lines[0]).toMatchObject({ type: "same", text: "head" });
    expect(lines.at(-1)).toMatchObject({ type: "same", text: "tail" });
    expect(new Set(lines.map((entry) => entry.key)).size).toBe(lines.length);
  });
});
