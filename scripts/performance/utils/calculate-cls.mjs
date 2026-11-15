export function calculateCls(shifts) {
  let maximum = 0;
  let score = 0;
  let first = 0;
  let previous = 0;
  for (const shift of shifts) {
    if (shift.hadRecentInput) {
      continue;
    }
    if (
      score === 0 ||
      shift.startTime - previous >= 1000 ||
      shift.startTime - first >= 5000
    ) {
      score = 0;
      first = shift.startTime;
    }
    score += shift.value;
    maximum = Math.max(maximum, score);
    previous = shift.startTime;
  }
  return maximum;
}
