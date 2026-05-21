import type { TaskState } from "../fsm/types.js";
export interface CreateTaskOptions {
    level?: "S" | "M" | "L" | "CRITICAL";
    cwd?: string;
}
export declare function createTask(title: string, harnessDir: string, opts?: CreateTaskOptions): TaskState;
export declare function loadTask(taskDir: string): TaskState | null;
export declare function saveTask(state: TaskState): void;
export declare function listTasks(cwd: string): TaskState[];
//# sourceMappingURL=creator.d.ts.map