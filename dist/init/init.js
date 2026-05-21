import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { TEMPLATE_FILES } from "./types.js";
import { sha256 } from "../utils/hash.js";
import { scanProject } from "./scanner.js";
import { generateDiff } from "./differ.js";
export async function runInit(cwd, opts = {}) {
    const templateDir = getTemplateDir();
    const scan = await scanProject(cwd);
    console.log(`\nScanning project at ${cwd}`);
    console.log(`   Git repo: ${scan.isGitRepo}`);
    console.log(`   Project type: ${scan.projectType}`);
    console.log(`   Detected runtimes: ${scan.detectedRuntimes.length > 0 ? scan.detectedRuntimes.join(", ") : "none"}`);
    const diff = generateDiff(scan, cwd, templateDir);
    console.log(`\nPlan:`);
    console.log(`   New files:      ${diff.newFiles.length}`);
    console.log(`   Updated files:  ${diff.updatedFiles.length}`);
    console.log(`   Skipped (user modified): ${diff.skippedFiles.length}`);
    console.log(`   Backed up:      ${diff.backedUpFiles.length}`);
    if (diff.newFiles.length === 0 && diff.updatedFiles.length === 0) {
        console.log("\nProject is already initialized. Nothing to do.");
        return;
    }
    // Dry run
    if (opts.dryRun) {
        console.log("\n(Dry run - no changes applied)");
        if (diff.newFiles.length > 0) {
            console.log("\nWould create:");
            for (const f of diff.newFiles)
                console.log(`  + ${f}`);
        }
        if (diff.updatedFiles.length > 0) {
            console.log("\nWould update:");
            for (const f of diff.updatedFiles)
                console.log(`  ~ ${f}`);
        }
        return;
    }
    // Backup user modifications
    if (diff.backedUpFiles.length > 0) {
        const backupDir = join(cwd, ".helm-backups");
        mkdirSync(backupDir, { recursive: true });
        for (const file of diff.backedUpFiles) {
            const src = join(cwd, file);
            const safe = file.replace(/[\/]/g, "-");
            const dest = join(backupDir, safe);
            copyFileSync(src, dest);
            console.log(`   Backed up: ${file}`);
        }
    }
    // Build a lookup: destPath -> srcPath
    const srcMap = new Map(TEMPLATE_FILES.map(([d, s]) => [d, s]));
    // Create directories and copy files
    const manifest = [];
    for (const file of [...diff.newFiles, ...diff.updatedFiles]) {
        ensureParentDir(join(cwd, file));
        const srcPath = srcMap.get(file);
        if (!srcPath) {
            console.warn(`   No source mapping for: ${file}`);
            continue;
        }
        const src = join(templateDir, srcPath);
        const dest = join(cwd, file);
        if (!existsSync(src)) {
            console.warn(`   Template not found: ${src}`);
            continue;
        }
        copyFileSync(src, dest);
        const hash = sha256(readFileSync(dest));
        manifest.push({ path: file, hash });
        const prefix = diff.newFiles.includes(file) ? "Created" : "Updated";
        console.log(`   + ${prefix}: ${file}`);
    }
    // Make gate scripts executable (unix)
    const gatesDir = join(cwd, "harness/gates");
    if (existsSync(gatesDir)) {
        for (const f of readdirSync(gatesDir)) {
            if (f.endsWith(".sh")) {
                try {
                    const { execSync } = await import("child_process");
                    execSync(`chmod +x "${join(gatesDir, f)}"`, { stdio: "ignore" });
                }
                catch {
                    // ignore on windows
                }
            }
        }
    }
    // Write manifest
    const manifestPath = join(cwd, ".helm-manifest.json");
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    console.log(`\nManifest written: .helm-manifest.json`);
    // Generate runtime-specific skills
    if (scan.detectedRuntimes.length > 0) {
        for (const runtime of scan.detectedRuntimes) {
            generateRuntimeSkill(cwd, runtime);
        }
    }
    console.log("\nHelm initialized successfully.");
    if (diff.skippedFiles.length > 0) {
        console.log(`\n${diff.skippedFiles.length} file(s) skipped (user modified). Check .helm-backups/`);
    }
}
function getTemplateDir() {
    let startDir = process.cwd();
    try {
        const url = import.meta.url;
        if (url.startsWith("file://")) {
            let dir = url.replace("file://", "").replace("file:/", "");
            dir = dir.replace(/^\/([A-Z]:)/i, "$1");
            startDir = dirname(dir);
        }
    }
    catch {
        // fallback to cwd
    }
    // Search up to 10 levels
    let current = startDir;
    for (let i = 0; i < 10; i++) {
        if (existsSync(join(current, "templates", "base", "AGENTS.md"))) {
            return join(current, "templates");
        }
        const parent = dirname(current);
        if (parent === current)
            break;
        current = parent;
    }
    // Fallback
    const candidates = [
        join(process.cwd(), "templates"),
        join(process.cwd(), "helm", "templates"),
    ];
    for (const c of candidates) {
        if (existsSync(join(c, "base", "AGENTS.md")))
            return c;
    }
    return candidates[0];
}
function ensureParentDir(filePath) {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}
function generateRuntimeSkill(cwd, runtime) {
    const skillContent = `---
name: helm
description: Harness-Driven AI Agent Orchestrator. Initialize projects, manage tasks, run gates.
argument-hint: <action> [options] - actions: init, task, build, gate, status
---

<helm_commands>
Run \`helm init\` to initialize the current project.
Run \`helm task "description" --level M\` to create a new task.
Run \`helm gate run --profile standard\` to run quality gates.
Run \`helm status\` to check current state.
</helm_commands>

<harness_location>
The Helm environment is in the \`harness/\` directory at project root.
Templates are in \`harness/templates/\`, profiles in \`harness/profiles/\`, gates in \`harness/gates/\`.
</harness_location>
`;
    const skillPaths = {
        claude: ".claude/skills/harness",
        codex: ".codex/skills/harness",
        gemini: ".gemini/skills/harness",
        cursor: ".cursor/skills/harness",
        opencode: ".opencode/skills/harness",
        copilot: ".github/skills/harness",
    };
    const destDir = join(cwd, skillPaths[runtime]);
    mkdirSync(destDir, { recursive: true });
    writeFileSync(join(destDir, "SKILL.md"), skillContent.trim() + "\n");
    console.log(`   Runtime skill generated: ${skillPaths[runtime]}/SKILL.md`);
}
//# sourceMappingURL=init.js.map