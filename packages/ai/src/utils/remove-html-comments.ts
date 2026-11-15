// GitHub hides everything after an unterminated `<!--`, so that counts too.
const HTML_COMMENT_PATTERN = /<!--[\s\S]*?(?:-->|$)/g;
const HTML_COMMENT_OPEN = "<!--";
// Each pass is linear; crafted nesting otherwise needs one pass per level.
const MAX_PASSES = 32;

/**
 * One pass is not enough: removing the inner comment of
 * `<!-<!-- x -->- @notra -->` leaves a new comment behind. Repeat until
 * nothing changes. Past the pass limit, everything from the first remaining
 * `<!--` is dropped, which hides more text, never less.
 */
export function removeHtmlComments(value: string) {
  let current = value;
  let previous = "";
  for (let pass = 0; current !== previous; pass += 1) {
    if (pass === MAX_PASSES) {
      const open = current.indexOf(HTML_COMMENT_OPEN);
      return open === -1 ? current : current.slice(0, open);
    }
    previous = current;
    current = current.replace(HTML_COMMENT_PATTERN, "");
  }
  return current;
}
