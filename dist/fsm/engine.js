import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { DEFAULT_TRANSITIONS, DEFAULT_GUARDS } from "./types.js";
export function createFsm(initialState = "idle") {
    const state = {
        current: initialState,
        history: [],
        guardResults: {},
        lastEvent: null,
        lastTransitionAt: null,
    };
    return {
        state,
        fire(event, guardContext = {}) {
            const transition = DEFAULT_TRANSITIONS.find((t) => (t.from === this.state.current || t.from === "*") && t.event === event);
            if (!transition) {
                return { ok: false, error: `No transition for event "${event}" from state "${this.state.current}"` };
            }
            // Check guard if exists
            const guard = DEFAULT_GUARDS.find((g) => g.event === event);
            if (guard) {
                const passed = evalGuard(guard.expression, guardContext);
                this.state.guardResults[event] = passed;
                if (!passed) {
                    return { ok: false, error: `Guard failed for event "${event}": ${guard.expression}` };
                }
            }
            this.state.history.push({
                state: this.state.current,
                event,
                at: new Date().toISOString(),
            });
            this.state.current = transition.to;
            this.state.lastEvent = event;
            this.state.lastTransitionAt = new Date().toISOString();
            return { ok: true };
        },
        canFire(event) {
            return DEFAULT_TRANSITIONS.some((t) => (t.from === this.state.current || t.from === "*") && t.event === event);
        },
        save(taskDir) {
            mkdirSync(taskDir, { recursive: true });
            const statePath = join(taskDir, "state.json");
            writeFileSync(statePath, JSON.stringify(this.state, null, 2) + "\n");
        },
    };
}
export function loadFsm(taskDir) {
    const statePath = join(taskDir, "state.json");
    if (!existsSync(statePath))
        return null;
    const raw = JSON.parse(readFileSync(statePath, "utf-8"));
    const fsm = createFsm(raw.current);
    fsm.state.history = raw.history ?? [];
    fsm.state.guardResults = raw.guardResults ?? {};
    fsm.state.lastEvent = raw.lastEvent ?? null;
    fsm.state.lastTransitionAt = raw.lastTransitionAt ?? null;
    return fsm;
}
function evalGuard(expr, ctx) {
    if (expr === "criticApproval === true") {
        return ctx.criticApproval === true;
    }
    if (expr === "all gateResults passed") {
        const gateResults = ctx.gateResults;
        if (!gateResults)
            return false;
        return gateResults.every((r) => r.passed);
    }
    return true;
}
//# sourceMappingURL=engine.js.map