// File mappings: [destination_path_in_project, source_path_in_templates_dir]
export const TEMPLATE_FILES = [
    // Base files (root)
    ["AGENTS.md", "base/AGENTS.md"],
    ["CLAUDE.md", "base/CLAUDE.md"],
    // Commands
    ["harness/commands/execute.md", "commands/execute.md"],
    ["harness/commands/plan.md", "commands/plan.md"],
    ["harness/commands/verify.md", "commands/verify.md"],
    ["harness/commands/review.md", "commands/review.md"],
    // Templates
    ["harness/templates/prd.md", "templates/prd.md"],
    ["harness/templates/explore.md", "templates/explore.md"],
    ["harness/templates/plan.md", "templates/plan.md"],
    ["harness/templates/verification.md", "templates/verification.md"],
    ["harness/templates/summary.md", "templates/summary.md"],
    // Profiles
    ["harness/profiles/minimal.json", "profiles/minimal.json"],
    ["harness/profiles/standard.json", "profiles/standard.json"],
    ["harness/profiles/expanded.json", "profiles/expanded.json"],
    ["harness/profiles/critical.json", "profiles/critical.json"],
    // Gates
    ["harness/gates/G0-build.sh", "gates/G0-build.sh"],
    ["harness/gates/G1-explore.sh", "gates/G1-explore.sh"],
    ["harness/gates/G2-plan.sh", "gates/G2-plan.sh"],
    ["harness/gates/G3-tdd.sh", "gates/G3-tdd.sh"],
    ["harness/gates/G4-lint.sh", "gates/G4-lint.sh"],
    ["harness/gates/G5-test.sh", "gates/G5-test.sh"],
    ["harness/gates/G6-coverage.sh", "gates/G6-coverage.sh"],
    ["harness/gates/G7-security.sh", "gates/G7-security.sh"],
];
export const ALL_TEMPLATE_FILES = TEMPLATE_FILES.map((t) => t[0]);
//# sourceMappingURL=types.js.map