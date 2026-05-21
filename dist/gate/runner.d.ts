import type { ProfileConfig, GateResult, GateRunReport } from "./types.js";
export declare function loadProfile(name: string, harnessDir: string): ProfileConfig | null;
export declare function listProfiles(harnessDir: string): string[];
export declare function runGate(gateName: string, gatesDir: string, cwd: string, timeoutMs?: number): Promise<GateResult>;
export declare function runGates(gateNames: string[], harnessDir: string, cwd: string, taskId: string, profileName: string, timeoutMs?: number): Promise<GateRunReport>;
//# sourceMappingURL=runner.d.ts.map