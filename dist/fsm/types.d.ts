import type { ProfileConfig } from "../gate/types.js";
export type FsmStateName = "idle" | "parsing_req" | "building_harness" | "exploring" | "planning" | "executing" | "verifying" | "archiving" | "done" | "failed";
export interface FsmState {
    current: FsmStateName;
    history: Array<{
        state: FsmStateName;
        event: string;
        at: string;
    }>;
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
export declare const DEFAULT_TRANSITIONS: FsmTransition[];
export declare const DEFAULT_GUARDS: FsmGuard[];
//# sourceMappingURL=types.d.ts.map