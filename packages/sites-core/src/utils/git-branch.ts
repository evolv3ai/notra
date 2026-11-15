/** Git check-ref-format --branch rules, with a bounded API input size. */
export function isValidGitBranch(branch: string): boolean {
  return (
    branch.length > 0 &&
    branch.length <= 250 &&
    !branch.startsWith("-") &&
    !branch.startsWith("/") &&
    !branch.endsWith("/") &&
    !branch.endsWith(".") &&
    branch !== "@" &&
    !branch.includes("..") &&
    !branch.includes("@{") &&
    ![...branch].some(
      (character) =>
        character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127
    ) &&
    !/[~^:?*[\\]/.test(branch) &&
    branch
      .split("/")
      .every(
        (part) =>
          part.length > 0 && !part.startsWith(".") && !part.endsWith(".lock")
      )
  );
}
