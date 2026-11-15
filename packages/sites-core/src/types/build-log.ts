export type SiteBuildLogTone =
  | "default"
  | "muted"
  | "success"
  | "warning"
  | "error";

export interface SiteBuildLogLine {
  number: number;
  timestamp: string | null;
  text: string;
  tone: SiteBuildLogTone;
  continued: boolean;
}

export type SiteBuildLogEntry =
  | { kind: "line"; line: SiteBuildLogLine }
  | {
      kind: "fold";
      id: string;
      lines: SiteBuildLogLine[];
      tone: SiteBuildLogTone;
    };

export type SiteBuildLogFold = Extract<SiteBuildLogEntry, { kind: "fold" }>;

export interface SiteBuildLogTagParts {
  tag: string | null;
  rest: string;
}
