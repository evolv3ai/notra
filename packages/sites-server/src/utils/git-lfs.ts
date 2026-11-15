import { GITHUB_LFS_POINTER_HEADER } from "../constants/github";

export function isGitLfsPointer(bytes: Uint8Array): boolean {
  const header = new TextDecoder().decode(
    bytes.subarray(0, GITHUB_LFS_POINTER_HEADER.length + 2)
  );
  return (
    header.startsWith(`${GITHUB_LFS_POINTER_HEADER}\n`) ||
    header.startsWith(`${GITHUB_LFS_POINTER_HEADER}\r\n`)
  );
}
