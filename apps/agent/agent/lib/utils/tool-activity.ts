export function withToolActivityLabel<T extends object>(
  tool: T,
  label: string
) {
  return Object.assign(tool, { label: { start: () => label } });
}
