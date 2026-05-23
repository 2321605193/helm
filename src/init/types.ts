export interface ScanResult {
  cwd: string;
  isGitRepo: boolean;
  hasAgentsMd: boolean;
  agentsMdContent: string | null;
  hasClaudeMd: boolean;
  claudeMdContent: string | null;
  hasHarnessDir: boolean;
  existingHarnessFiles: string[];
  existingScriptsDir: boolean;
  projectType: "node" | "python" | "rust" | "go" | "java" | "ruby" | "unknown";
  detectedRuntimes: DetectedRuntime[];
  existingManifest: ManifestEntry[] | null;
}

export interface ManifestEntry {
  path: string;
  hash: string;
}

/**
 * Three-way diff classification for each managed file.
 *
 * The three inputs per file are:
 *   - template: the content Helm currently ships
 *   - disk:     the file currently on disk (may be absent)
 *   - baseline: the hash recorded in .helm-manifest.json at last install (the merge-base)
 *
 * Each managed file lands in exactly one bucket:
 *   - newFiles:       absent on disk                                  -> create
 *   - unchangedFiles: present and already equal to template          -> nothing to do
 *   - updatedFiles:   present, differs from template, but == baseline -> safe to overwrite
 *   - conflictFiles:  present, differs from template, and has no
 *                     baseline (user's own file) or differs from
 *                     baseline (user edited it since install)        -> skip, or back up + overwrite under --force
 */
export interface DiffReport {
  newFiles: string[];
  updatedFiles: string[];
  conflictFiles: string[];
  unchangedFiles: string[];
}

export interface InstallOptions {
  dryRun?: boolean;
  force?: boolean;
}

export type DetectedRuntime = "claude" | "codex" | "gemini" | "cursor" | "opencode" | "copilot";

// File mappings: [destination_path_in_project, source_path_in_templates_dir]
export const TEMPLATE_FILES: Array<[dest: string, src: string]> = [
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
