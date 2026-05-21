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
export interface DiffReport {
    newFiles: string[];
    updatedFiles: string[];
    skippedFiles: string[];
    backedUpFiles: string[];
}
export interface InstallOptions {
    dryRun?: boolean;
    force?: boolean;
}
export type DetectedRuntime = "claude" | "codex" | "gemini" | "cursor" | "opencode" | "copilot";
export declare const TEMPLATE_FILES: Array<[dest: string, src: string]>;
export declare const ALL_TEMPLATE_FILES: string[];
//# sourceMappingURL=types.d.ts.map