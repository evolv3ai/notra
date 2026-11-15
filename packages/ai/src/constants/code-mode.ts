export const CODE_MODE_TOOL_NAME = "code_mode";
export const CODE_MODE_TIMEOUT_MS = 120_000;

export const STANDALONE_CODE_MODE_TOOL_NAMES = [
  "getPullRequests",
  "getReleaseByTag",
  "getCommitsByTimeframe",
  "getLinearIssues",
  "getLinearProjects",
  "getLinearCycles",
  "getGranolaNotes",
  "getGranolaNote",
  "getGranolaFolders",
  "getAvailablePosts",
  "getPost",
  "viewPost",
  "getAvailableIntegrations",
  "getAvailableBrandReferences",
  "listSchedules",
  "getPostSchedule",
  "listAvailableSkills",
  "getSkillByName",
  "webSearch",
  "fetchWebpage",
  "listGeoProjects",
  "getGeoPromptResults",
  "getGeoProjectContext",
] as const;
