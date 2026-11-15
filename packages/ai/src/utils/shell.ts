/** POSIX single-quotes a shell argument. NUL bytes cannot be passed through argv, so they are rejected. */
export function shellQuote(value: string): string {
  if (value.includes("\0")) {
    throw new Error("Arguments cannot contain NUL bytes.");
  }
  return `'${value.replaceAll("'", "'\\''")}'`;
}
