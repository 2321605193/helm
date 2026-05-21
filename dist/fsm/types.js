export const DEFAULT_TRANSITIONS = [
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
export const DEFAULT_GUARDS = [
    { event: "plan_approved", expression: "criticApproval === true" },
    { event: "gates_passed", expression: "all gateResults passed" },
];
//# sourceMappingURL=types.js.map