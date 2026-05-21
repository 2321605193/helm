import type { ProfileConfig } from "../gate/types.js";

export type FsmStateName =
  | "idle"
  | "parsing_req"
  | "building_harness"
  | "exploring"
  | "planning"
  | "executing"
  | "verifying"
  | "archiving"
  | "done"
  | "failed";

export interface FsmState {
  current: FsmStateName;
  history: Array<{ state: FsmStateName; event: string; at: string }>;
  guardResults: Record<string, boolean>;
  lastEvent: string | null;
  lastTransitionAt: string | null;
}

export interface WaveInfo {
  waveNumber: number;
  description: string;
  tasks: string[];
  dependsOn: number[];
  status: "pending" | "running" | "done" | "failed";
}

export interface TaskState {
  id: string;
  title: string;
  level: "S" | "M" | "L" | "CRITICAL";
  profile: ProfileConfig | null;
  stateMachine: FsmState;
  taskDir: string;
  createdAt: string;
  updatedAt: string;
  waves: WaveInfo[];
}

export interface FsmTransition {
  from: FsmStateName | "*";
  event: string;
  to: FsmStateName;
}

export interface FsmGuard {
  event: string;
  expression: string;
}

export const DEFAULT_TRANSITIONS: FsmTransition[] = [
  { from: "idle", event: "start", to: "parsing_req" },
  { from: "parsing_req", event: "prd_ready", to: "building_harness" },
  { from: "building_harness", event: "harness_ready", to: "exploring" },
  { from: "exploring", event: "explore_done", to: "planning" },
  { from: "planning", event: "plan_approved", to: "executing" },
  { from: "executing", event: "all_waves_done", to: "verifying" },
  { from: "verifying", event: "gates_passed", to: "archiving" },
  { from: "verifying", event: "gates_failed", to: "executing" },
  { from: "archiving", event: "archive_done", to: "done" },
  { from: "*", event: "critical_error", to: "failed" },
];

export const DEFAULT_GUARDS: FsmGuard[] = [
  { event: "plan_approved", expression: "criticApproval === true" },
  { event: "gates_passed", expression: "all gateResults passed" },
];
