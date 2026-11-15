import type { ChildProcess } from "node:child_process";

import type { SiteMountedArea } from "@notra/sites-core/types/deployment";

export interface DevAreaServer extends SiteMountedArea {
  port: number;
  paramsPath: string;
  hmrToken?: string;
  hmrGeneration?: number;
  documentToken?: string;
}

export interface RunningDevArea {
  area: DevAreaServer;
  child: ChildProcess;
}
