import {
  COMMENT_ANCHOR_CONTEXT_LENGTH,
  COMMENT_ANCHOR_HIGH_SURROGATE_REGEX,
  COMMENT_ANCHOR_LONE_SURROGATE_REGEX,
  COMMENT_ANCHOR_LOW_SURROGATE_REGEX,
  COMMENT_ANCHOR_MAX_EXACT_LENGTH,
  COMMENT_ANCHOR_TEXT_NODE_TYPE,
  COMMENT_ANCHOR_WHITESPACE_REGEX,
} from "@/constants/comments";
import type {
  CommentAnchorMatch,
  CommentAnchorQuote,
  CommentAnchorTextNode,
  CommentAnchorTextPoint,
  CommentSelectionLike,
} from "@/types/content/inline-comments";

const isText = (node: CommentAnchorTextNode) =>
  node.nodeType === COMMENT_ANCHOR_TEXT_NODE_TYPE;

const isSkipped = (node: CommentAnchorTextNode) =>
  node.getAttribute?.("contenteditable") === "false";

function textLength(node: CommentAnchorTextNode): number {
  if (isText(node)) {
    return node.nodeValue?.length ?? 0;
  }
  if (isSkipped(node)) {
    return 0;
  }
  let total = 0;
  for (const child of Array.from(node.childNodes)) {
    total += textLength(child);
  }
  return total;
}

export function collectCommentTextNodes<T extends CommentAnchorTextNode>(
  root: T
): T[] {
  const nodes: T[] = [];
  const visit = (node: T) => {
    if (isText(node)) {
      nodes.push(node);
      return;
    }
    if (node !== root && isSkipped(node)) {
      return;
    }
    for (const child of Array.from(node.childNodes)) {
      visit(child as T);
    }
  };
  visit(root);
  return nodes;
}

export function commentTextContent(nodes: CommentAnchorTextNode[]) {
  return nodes.map((node) => node.nodeValue ?? "").join("");
}

export function commentTextOffset(
  root: CommentAnchorTextNode,
  container: CommentAnchorTextNode,
  offset: number
): number | null {
  let total = 0;
  const visit = (node: CommentAnchorTextNode): boolean => {
    if (node !== root && !isText(node) && isSkipped(node)) {
      return false;
    }
    if (node === container) {
      if (isText(node)) {
        total += Math.min(Math.max(offset, 0), node.nodeValue?.length ?? 0);
        return true;
      }
      const children = Array.from(node.childNodes).slice(
        0,
        Math.max(0, offset)
      );
      for (const child of children) {
        total += textLength(child);
      }
      return true;
    }
    if (isText(node)) {
      total += node.nodeValue?.length ?? 0;
      return false;
    }
    for (const child of Array.from(node.childNodes)) {
      if (visit(child)) {
        return true;
      }
    }
    return false;
  };
  return visit(root) ? total : null;
}

function commentSelectionOffsets(
  root: CommentAnchorTextNode,
  anchor: { node: CommentAnchorTextNode; offset: number },
  focus: { node: CommentAnchorTextNode; offset: number }
): CommentAnchorMatch | null {
  const anchorOffset = commentTextOffset(root, anchor.node, anchor.offset);
  const focusOffset = commentTextOffset(root, focus.node, focus.offset);
  if (anchorOffset === null || focusOffset === null) {
    return null;
  }
  return {
    start: Math.min(anchorOffset, focusOffset),
    end: Math.max(anchorOffset, focusOffset),
  };
}

function commentTextPoint<T extends CommentAnchorTextNode>(
  nodes: T[],
  offset: number,
  edge: "start" | "end"
): CommentAnchorTextPoint<T> | null {
  let consumed = 0;
  for (const node of nodes) {
    const length = node.nodeValue?.length ?? 0;
    const inside =
      edge === "start"
        ? offset < consumed + length
        : offset > consumed && offset <= consumed + length;
    if (inside) {
      return { node, offset: offset - consumed };
    }
    consumed += length;
  }
  return null;
}

function captureCommentAnchor(
  text: string,
  from: number,
  to: number
): CommentAnchorQuote | null {
  let start = Math.max(0, Math.min(from, to));
  let end = Math.min(text.length, Math.max(from, to));
  while (
    start < end &&
    COMMENT_ANCHOR_WHITESPACE_REGEX.test(text[start] ?? "")
  ) {
    start += 1;
  }
  while (
    end > start &&
    COMMENT_ANCHOR_WHITESPACE_REGEX.test(text[end - 1] ?? "")
  ) {
    end -= 1;
  }
  if (start === end || end - start > COMMENT_ANCHOR_MAX_EXACT_LENGTH) {
    return null;
  }
  let prefixStart = Math.max(0, start - COMMENT_ANCHOR_CONTEXT_LENGTH);
  if (
    prefixStart > 0 &&
    COMMENT_ANCHOR_LOW_SURROGATE_REGEX.test(text[prefixStart] ?? "")
  ) {
    prefixStart += 1;
  }
  let suffixEnd = Math.min(text.length, end + COMMENT_ANCHOR_CONTEXT_LENGTH);
  if (
    suffixEnd < text.length &&
    COMMENT_ANCHOR_HIGH_SURROGATE_REGEX.test(text[suffixEnd - 1] ?? "")
  ) {
    suffixEnd -= 1;
  }
  const quote = {
    exact: text.slice(start, end),
    prefix: text.slice(Math.min(prefixStart, start), start),
    suffix: text.slice(end, Math.max(suffixEnd, end)),
    start,
    end,
  };
  const malformed = [quote.prefix, quote.exact, quote.suffix].some((part) =>
    COMMENT_ANCHOR_LONE_SURROGATE_REGEX.test(part)
  );
  return malformed ? null : quote;
}

function isCommentAnchorCurrent(text: string, quote: CommentAnchorQuote) {
  return (
    quote.start >= quote.prefix.length &&
    quote.end - quote.start === quote.exact.length &&
    text.slice(quote.start, quote.end) === quote.exact &&
    text.slice(quote.start - quote.prefix.length, quote.start) ===
      quote.prefix &&
    text.slice(quote.end, quote.end + quote.suffix.length) === quote.suffix
  );
}

export function captureSelectionCommentAnchor<T extends CommentAnchorTextNode>(
  root: T,
  selection: CommentSelectionLike<T> | null
): CommentAnchorQuote | null {
  if (!(selection?.anchorNode && selection.focusNode)) {
    return null;
  }
  const offsets = commentSelectionOffsets(
    root,
    { node: selection.anchorNode, offset: selection.anchorOffset },
    { node: selection.focusNode, offset: selection.focusOffset }
  );
  if (!offsets) {
    return null;
  }
  return captureCommentAnchor(
    commentTextContent(collectCommentTextNodes(root)),
    offsets.start,
    offsets.end
  );
}

export function refreshCommentAnchor(
  root: CommentAnchorTextNode,
  quote: CommentAnchorQuote
): CommentAnchorQuote | null {
  const text = commentTextContent(collectCommentTextNodes(root));
  const match = resolveCommentAnchor(text, quote, false);
  if (!match) {
    return null;
  }
  const fresh = captureCommentAnchor(text, match.start, match.end);
  return fresh?.exact === quote.exact ? fresh : null;
}

export function createCommentRange(
  root: Node,
  match: CommentAnchorMatch,
  nodes = collectCommentTextNodes(root)
) {
  const start = commentTextPoint(nodes, match.start, "start");
  const end = commentTextPoint(nodes, match.end, "end");
  if (!(start && end)) {
    return null;
  }
  const range = root.ownerDocument?.createRange();
  if (!range) {
    return null;
  }
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return range;
}

export function commentMatchAnchor(
  root: HTMLElement,
  match: CommentAnchorMatch
) {
  return {
    contextElement: root,
    getBoundingClientRect: () =>
      createCommentRange(root, match)?.getBoundingClientRect() ??
      root.getBoundingClientRect(),
  };
}

export function resolveCommentAnchor(
  text: string,
  quote: CommentAnchorQuote,
  trustStoredOffset = true
): CommentAnchorMatch | null {
  const { exact, prefix, suffix } = quote;
  if (!exact || quote.end - quote.start !== exact.length) {
    return null;
  }
  if (trustStoredOffset && isCommentAnchorCurrent(text, quote)) {
    return { start: quote.start, end: quote.end };
  }
  const occurrences: number[] = [];
  let index = text.indexOf(exact);
  while (index !== -1) {
    occurrences.push(index);
    index = text.indexOf(exact, index + 1);
  }
  if (occurrences.length === 0) {
    return null;
  }
  const atDocumentStart = quote.start === prefix.length;
  const atDocumentEnd = suffix.length < COMMENT_ANCHOR_CONTEXT_LENGTH - 1;
  const prefixMatches = (start: number) =>
    start >= prefix.length &&
    text.startsWith(prefix, start - prefix.length) &&
    (!atDocumentStart || start === prefix.length);
  const suffixMatches = (start: number) => {
    const end = start + exact.length;
    return (
      text.startsWith(suffix, end) &&
      (!atDocumentEnd || end + suffix.length === text.length)
    );
  };
  const both = occurrences.filter(
    (start) => prefixMatches(start) && suffixMatches(start)
  );
  const either = both.length
    ? both
    : occurrences.filter(
        (start) => prefixMatches(start) || suffixMatches(start)
      );
  if (either.length === 0) {
    return null;
  }
  const start = either.reduce((closest, candidate) =>
    Math.abs(candidate - quote.start) < Math.abs(closest - quote.start)
      ? candidate
      : closest
  );
  return { start, end: start + exact.length };
}
