export interface SpawnAsyncOptions {
  cwd?: string | URL;
  env?: NodeJS.ProcessEnv;
  /** Written to the child's stdin, which is then closed. */
  input?: string;
  /** The child is killed with SIGKILL after this many milliseconds. */
  timeoutMs: number;
}

export interface SpawnAsyncResult {
  /** Exit code, or null when the child was killed or could not start. */
  status: number | null;
  stdout: string;
  stderr: string;
}
