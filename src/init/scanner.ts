import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import type { ScanResult, ManifestEntry } from "./types.js";

const DETECT_FILES: Record<string, "node" | "python" | "rust" | "go" | "java" | "ruby"> = {
  "package.json": "node",
  "pyproject.toml": "python",
  "Cargo.toml": "rust",
  "go.mod": "go",
  "pom.xml": "java",
  "Gemfile": "ruby",
};

const RUNTIME_DIRS: Record<string, "claude" | "codex" | "gemini" | "cursor" | "opencode" | "copilot"> = {
  ".claude": "claude",
  ".codex": "codex",
  ".gemini": "gemini",
  ".cursor": "cursor",
  ".opencode": "opencode",
  ".github": "copilot",
};

export async function scanProject(cwd: string): Promise<ScanResult> {
  const result: ScanResult = {
    cwd,
    isGitRepo: existsSync(join(cwd, ".git")),
    hasAgentsMd: false,
    agentsMdContent: null,
    hasClaudeMd: false,
    claudeMdContent: null,
    hasHarnessDir: false,
    existingHarnessFiles: [],
    existingScriptsDir: false,
    projectType: "unknown",
    detectedRuntimes: [],
    existingManifest: null,
  };

  // Check AGENTS.md
  const agentsPath = join(cwd, "AGENTS.md");
  if (existsSync(agentsPath)) {
    result.hasAgentsMd = true;
    result.agentsMdContent = readFileSync(agentsPath, "utf-8");
  }

  // Check CLAUDE.md
  const claudePath = join(cwd, "CLAUDE.md");
  if (existsSync(claudePath)) {
    result.hasClaudeMd = true;
    result.claudeMdContent = readFileSync(claudePath, "utf-8");
  }

  // Check harness/ directory
  const harnessDir = join(cwd, "harness");
  if (existsSync(harnessDir) && statSync(harnessDir).isDirectory()) {
    result.hasHarnessDir = true;
    result.existingHarnessFiles = listFilesRelative(harnessDir, cwd);
  }

  // Check scripts/ directory
  if (existsSync(join(cwd, "scripts"))) {
    result.existingScriptsDir = true;
  }

  // Detect project type
  for (const [file, type] of Object.entries(DETECT_FILES)) {
    if (existsSync(join(cwd, file))) {
      result.projectType = type;
      break;
    }
  }

  // Detect runtimes
  for (const [dir, runtime] of Object.entries(RUNTIME_DIRS)) {
    if (existsSync(join(cwd, dir))) {
      result.detectedRuntimes.push(runtime);
    }
  }

  // Check existing manifest
  const manifestPath = join(cwd, ".helm-manifest.json");
  if (existsSync(manifestPath)) {
    try {
      result.existingManifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as ManifestEntry[];
    } catch {
      result.existingManifest = null;
    }
  }

  return result;
}

function listFilesRelative(dir: string, base: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...listFilesRelative(full, base));
    } else {
      files.push(full.replace(base + "/", "").replace(base + "\\", ""));
    }
  }
  return files;
}
