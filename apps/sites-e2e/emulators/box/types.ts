export interface BoxEmulatorOptions {
  directory: string;
  apiKey: string;
  failNext?: BoxFaultInjection;
}

export interface EmulatedBox {
  id: string;
  name: string;
  snapshotId: string;
  networkPolicy: string;
  /** Local directory standing in for /workspace/home. */
  home: string;
  deleted: boolean;
  commands: number;
}

export interface BoxFaultInjection {
  create: number;
  status?: number;
}
