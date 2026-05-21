export interface GateResult {
  gate: string;
  passed: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface GateRunReport {
  taskId: string;
  profile: string;
  startedAt: string;
  completedAt: string;
  results: GateResult[];
  overall: "passed" | "failed" | "skipped";
}

export interface ProfileConfig {
  level: "S" | "M" | "L" | "CRITICAL";
  description: string;
  gates: string[];
  templates: string[];
  approval: "auto" | "confirm_before_execute" | "manual";
  wave_parallel_limit: number;
  context_budget: {
    always_load: string[];
    max_files_per_read: number;
    max_total_tokens_estimate: number;
  };
  tools: {
    allowed: string[];
    restricted: string[];
    requires_approval: string[];
  };
  auto_commit: boolean;
  commit_convention?: string;
  requires_rollback?: boolean;
}
