export function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j] ?? 0;
      row[j] = Math.min(
        current + 1,
        (row[j - 1] ?? 0) + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      previous = current;
    }
  }
  return row[b.length] ?? 0;
}

/** The candidate within two edits of `name`, ignoring case, if any. */
export function closestName(
  name: string,
  candidates: readonly string[]
): string | undefined {
  const best = candidates
    .map((candidate) => ({
      candidate,
      score: editDistance(name.toLowerCase(), candidate.toLowerCase()),
    }))
    .sort((a, b) => a.score - b.score)[0];
  return best && best.score <= 2 ? best.candidate : undefined;
}
