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
export declare const TEMPLATE_FILES: Array<[dest: string, src: string]>;
export declare const ALL_TEMPLATE_FILES: string[];
//# sourceMappingURL=types.d.ts.map