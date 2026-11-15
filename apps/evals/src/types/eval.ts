export type ContenderKind = "llm" | "jev";

export interface Contender {
  readonly key: string;
  readonly modelId: string;
  readonly kind: ContenderKind;
  readonly label: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
}

export interface UsageLike {
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  inputTokenDetails?: { cacheReadTokens?: number };
}

export interface EvalCostStep {
  providerMetadata?: unknown;
  usage?: UsageLike;
}

export type CostSource = "reported" | "estimated" | "mixed" | "unknown";

export interface EvalCost {
  costUsd?: number;
  costSource: CostSource;
  reportedCostUsd: number;
  estimatedCostUsd: number;
}

export interface JudgeVerdict extends Partial<EvalCost> {
  readonly values: Record<string, number>;
}

export interface CallResult<OUTPUT> extends Partial<EvalCost> {
  output: OUTPUT;
  usage: TokenUsage;
  transcript?: string;
}

export interface CallContext {
  readonly contender: Contender;
  readonly abortSignal: AbortSignal;
  readonly demo: boolean;
}

export interface FieldScore {
  readonly field: string;
  readonly score: number;
  readonly expected?: string;
  readonly actual?: string;
  readonly note?: string;
}

export interface CaseScore {
  readonly score: number;
  readonly pass: boolean;
  readonly fields: readonly FieldScore[];
  readonly judgeCostUsd?: number;
  readonly judgeCostSource?: CostSource;
}

export interface DemoContext {
  readonly contender: Contender;
  readonly skill: number;
  readonly rng: () => number;
  hit(): boolean;
  pick<T>(correct: T, options: readonly T[]): T;
}

export interface EvalCase<INPUT, EXPECTED> {
  readonly id: string;
  readonly input: INPUT;
  readonly expected: EXPECTED;
  readonly title: string;
  readonly tags?: readonly string[];
}

export type SuiteKind = "classification" | "generation";

export interface ScoreContext {
  readonly abortSignal: AbortSignal;
  readonly demo: boolean;
}

export interface EvalSuite<
  INPUT = unknown,
  EXPECTED = unknown,
  OUTPUT = unknown,
> {
  readonly id: string;
  readonly name: string;
  readonly kind: SuiteKind;
  readonly stage: string;
  readonly description: string;
  readonly cases: readonly EvalCase<INPUT, EXPECTED>[];
  readonly defaultContenders: readonly string[];
  readonly productionModel: string;
  readonly labelFields?: readonly string[];
  readonly timeoutMs: number;
  run(input: INPUT, ctx: CallContext): Promise<CallResult<OUTPUT>>;
  score(
    output: OUTPUT,
    testCase: EvalCase<INPUT, EXPECTED>,
    ctx: ScoreContext
  ): Promise<CaseScore> | CaseScore;
  demoOutput(testCase: EvalCase<INPUT, EXPECTED>, demo: DemoContext): OUTPUT;
  transcript?(output: OUTPUT): string;
}

export type AnySuite = EvalSuite<any, any, any>;

export type TaskStatus = "queued" | "running" | "done" | "error";

export interface TaskResult extends Partial<EvalCost> {
  readonly contenderKey: string;
  readonly caseId: string;
  readonly repeat: number;
  status: TaskStatus;
  called?: boolean;
  startedAt?: number;
  durationMs?: number;
  score?: CaseScore;
  usage?: TokenUsage;
  output?: unknown;
  transcript?: string;
  error?: string;
}

export interface RunConfig {
  readonly suiteId: string;
  readonly contenders: readonly Contender[];
  readonly repeats: number;
  readonly concurrency: number;
  readonly demo: boolean;
  readonly caseIds?: readonly string[];
}

export type RunStatus = "running" | "done" | "cancelled" | "failed";

export interface EvalRun {
  readonly id: string;
  readonly config: RunConfig;
  readonly suiteName: string;
  readonly suiteKind: SuiteKind;
  readonly createdAt: string;
  finishedAt?: string;
  status: RunStatus;
  tasks: TaskResult[];
}

export interface ContenderSummary {
  readonly contenderKey: string;
  readonly label: string;
  readonly total: number;
  readonly done: number;
  readonly errors: number;
  readonly running: number;
  readonly accuracy: number;
  readonly passRate: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly costUsd?: number;
  readonly costSource: CostSource;
  readonly knownCostUsd: number;
  readonly judgeCostUsd?: number;
  readonly judgeCostSource?: CostSource;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly fieldAccuracy: Readonly<Record<string, number>>;
  readonly latencies: readonly number[];
}
