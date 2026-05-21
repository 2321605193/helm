import type { FsmState, FsmStateName } from "./types.js";
export interface FsmEngine {
    state: FsmState;
    fire(event: string, guardContext?: Record<string, unknown>): {
        ok: boolean;
        error?: string;
    };
    canFire(event: string): boolean;
    save(taskDir: string): void;
}
export declare function createFsm(initialState?: FsmStateName): FsmEngine;
export declare function loadFsm(taskDir: string): FsmEngine | null;
//# sourceMappingURL=engine.d.ts.map