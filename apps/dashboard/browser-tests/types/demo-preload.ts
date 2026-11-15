export interface DemoPreloadSample {
  variant: string;
  sample: number;
  requests: number;
  requestStart: number;
  hydrationStart: number;
  scriptExecuted: number;
  widgetReady: number;
  creationCalls: number;
  scriptCrossOrigin: string | null | undefined;
  hintCrossOrigin: string | null;
}
