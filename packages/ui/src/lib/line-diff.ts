import {
  LINE_DIFF_CONTEXT_LINES,
  LINE_DIFF_MAX_CELLS,
} from "../constants/line-diff";
import type { LineDiffLine, LineDiffRow } from "../types/line-diff";

function line(
  type: LineDiffLine["type"],
  text: string,
  before: number,
  after: number
): LineDiffLine {
  return { type, text, key: `${type}:${before}:${after}` };
}

function diffMiddle(a: string[], b: string[], offset: number): LineDiffLine[] {
  if (a.length * b.length > LINE_DIFF_MAX_CELLS) {
    return [
      ...a.map((text, i) => line("removed", text, offset + i, -1)),
      ...b.map((text, j) => line("added", text, -1, offset + j)),
    ];
  }

  const width = b.length + 1;
  const lcs = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lcs[i * width + j] =
        a[i] === b[j]
          ? (lcs[(i + 1) * width + j + 1] ?? 0) + 1
          : Math.max(
              lcs[(i + 1) * width + j] ?? 0,
              lcs[i * width + j + 1] ?? 0
            );
    }
  }

  const lines: LineDiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      lines.push(line("same", a[i] ?? "", offset + i, offset + j));
      i += 1;
      j += 1;
    } else if (
      i < a.length &&
      (j >= b.length ||
        (lcs[(i + 1) * width + j] ?? 0) >= (lcs[i * width + j + 1] ?? 0))
    ) {
      lines.push(line("removed", a[i] ?? "", offset + i, -1));
      i += 1;
    } else {
      lines.push(line("added", b[j] ?? "", -1, offset + j));
      j += 1;
    }
  }
  return lines;
}

export function diffLines(before: string, after: string): LineDiffLine[] {
  const a = before.split("\n");
  const b = after.split("\n");

  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) {
    start += 1;
  }
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }

  const shift = b.length - a.length;
  return [
    ...a.slice(0, start).map((text, i) => line("same", text, i, i)),
    ...diffMiddle(a.slice(start, endA), b.slice(start, endB), start),
    ...a
      .slice(endA)
      .map((text, i) => line("same", text, endA + i, endA + i + shift)),
  ];
}

export function collapseUnchanged(lines: LineDiffLine[]): LineDiffRow[] {
  const near = new Array<boolean>(lines.length).fill(false);
  lines.forEach((entry, index) => {
    if (entry.type === "same") {
      return;
    }
    const from = Math.max(0, index - LINE_DIFF_CONTEXT_LINES);
    const to = Math.min(lines.length - 1, index + LINE_DIFF_CONTEXT_LINES);
    for (let k = from; k <= to; k += 1) {
      near[k] = true;
    }
  });

  const rows: LineDiffRow[] = [];
  let hidden: LineDiffLine[] = [];
  const flush = () => {
    const first = hidden[0];
    if (first) {
      rows.push({
        type: "collapsed",
        count: hidden.length,
        key: `collapsed:${first.key}`,
      });
    }
    hidden = [];
  };
  lines.forEach((entry, index) => {
    if (near[index]) {
      flush();
      rows.push(entry);
    } else {
      hidden.push(entry);
    }
  });
  flush();
  return rows;
}
