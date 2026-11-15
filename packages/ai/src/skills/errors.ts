export class SystemSkillVersionConflictError extends Error {
  readonly currentVersion: number | null;

  constructor(name: string, currentVersion: number | null) {
    super(
      currentVersion === null
        ? `System skill "${name}" no longer exists.`
        : `System skill "${name}" is now at version ${currentVersion}. Reload and publish again.`
    );
    this.name = "SystemSkillVersionConflictError";
    this.currentVersion = currentVersion;
  }
}
