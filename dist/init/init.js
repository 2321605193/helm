import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { TEMPLATE_FILES } from "./types.js";
import { sha256 } from "../utils/hash.js";
import { scanProject } from "./scanner.js";
import { generateDiff } from "./differ.js";
import { resolveProjectCommands, renderProjectEnv } from "./project.js";
export async function runInit(cwd, opts = {}) {
    const templateDir = getTemplateDir();
    const scan = await scanProject(cwd);
    console.log(`\nScanning project at ${cwd}`);
    console.log(`   Git repo: ${scan.isGitRepo}`);
    console.log(`   Project type: ${scan.projectType}`);
    console.log(`   Detected runtimes: ${scan.detectedRuntimes.length > 0 ? scan.detectedRuntimes.join(", ") : "none"}`);
    const diff = generateDiff(scan, cwd, templateDir);
    const force = opts.force === true;
    // Conflicts are the user's own / user-modified files. By default we leave
    // them untouched; with --force we back them up and overwrite.
    const conflictAction = force ? "overwrite" : "skip";
    const toWrite = [...diff.newFiles, ...diff.updatedFiles, ...(force ? diff.conflictFiles : [])];
    const skipped = force ? [] : diff.conflictFiles;
    console.log(`\nPlan:`);
    console.log(`   New files:      ${diff.newFiles.length}`);
    console.log(`   Updated files:  ${diff.updatedFiles.length}`);
    console.log(`   Unchanged:      ${diff.unchangedFiles.length}`);
    console.log(`   Conflicts (${conflictAction}): ${diff.conflictFiles.length}`);
    // Dry run — show exactly what each command would do, then stop.
    if (opts.dryRun) {
        console.log("\n(Dry run - no changes applied)");
        for (const f of diff.newFiles)
            console.log(`  + create   ${f}`);
        for (const f of diff.updatedFiles)
            console.log(`  ~ update   ${f}`);
        for (const f of diff.conflictFiles) {
            console.log(force ? `  ! overwrite ${f} (backup first)` : `  = skip     ${f} (user modified — use --force to overwrite)`);
        }
        if (!existsSync(join(cwd, "harness/project.env")) || force) {
            const cmds = resolveProjectCommands(scan.projectType, readPackageScripts(cwd));
            console.log(`  + generate harness/project.env (type: ${cmds.type})`);
        }
        return;
    }
    // Back up files we are about to overwrite (only relevant under --force).
    const toBackup = force ? diff.conflictFiles.filter((f) => existsSync(join(cwd, f))) : [];
    if (toBackup.length > 0) {
        const backupDir = join(cwd, ".helm-backups");
        mkdirSync(backupDir, { recursive: true });
        for (const file of toBackup) {
            const safe = file.replace(/[/\\]/g, "-");
            copyFileSync(join(cwd, file), join(backupDir, safe));
            console.log(`   Backed up: ${file}`);
        }
    }
    // Build a lookup: destPath -> srcPath
    const srcMap = new Map(TEMPLATE_FILES.map(([d, s]) => [d, s]));
    // Create directories and copy files.
    for (const file of toWrite) {
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
        ensureParentDir(dest);
        copyFileSync(src, dest);
        const prefix = diff.newFiles.includes(file) ? "Created" : "Updated";
        console.log(`   + ${prefix}: ${file}`);
    }
    // Generate harness/project.env — concrete gate commands derived from the
    // detected project type (and the project's own package.json scripts). Seeded
    // once and then user-editable, so we only (re)write it when absent or --force.
    const projectEnvPath = join(cwd, "harness/project.env");
    if (!existsSync(projectEnvPath) || force) {
        const cmds = resolveProjectCommands(scan.projectType, readPackageScripts(cwd));
        ensureParentDir(projectEnvPath);
        writeFileSync(projectEnvPath, renderProjectEnv(cmds));
        console.log(`   + Project env: harness/project.env (type: ${cmds.type})`);
    }
    if (toWrite.length === 0 && skipped.length === 0) {
        console.log("\nProject is already initialized. Nothing to do.");
    }
    // Rebuild the manifest as the FULL set of managed files present on disk, so
    // it can serve as the baseline (merge-base) for the next run. For files we
    // own we record their on-disk hash; for skipped conflicts we preserve the
    // prior baseline rather than recording the user's current hash (which would
    // make us silently overwrite their edits next time).
    const manifest = buildManifest(cwd, scan, new Set(skipped));
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
    if (skipped.length > 0) {
        console.log(`\n${skipped.length} file(s) skipped (user modified). Re-run with --force to overwrite (originals are backed up).`);
    }
}
/**
 * Rebuild the manifest as the full set of managed files present on disk.
 *
 * For files Helm owns (everything not in `skipped`) we record the current
 * on-disk hash — after a write that equals the template hash. For skipped
 * conflicts we carry forward the previous baseline if one existed, and never
 * record the user's current hash, so a future template change is still seen as
 * a conflict instead of silently overwriting their edits.
 */
/** Read the `scripts` map from a Node project's package.json, if present. */
function readPackageScripts(cwd) {
    const pkgPath = join(cwd, "package.json");
    if (!existsSync(pkgPath))
        return undefined;
    try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        return pkg.scripts && typeof pkg.scripts === "object"
            ? pkg.scripts
            : undefined;
    }
    catch {
        return undefined;
    }
}
function buildManifest(cwd, scan, skipped) {
    const prev = new Map((scan.existingManifest ?? []).map((e) => [e.path, e.hash]));
    const manifest = [];
    for (const [destPath] of TEMPLATE_FILES) {
        const destFull = join(cwd, destPath);
        if (!existsSync(destFull))
            continue;
        if (skipped.has(destPath)) {
            const baseline = prev.get(destPath);
            if (baseline)
                manifest.push({ path: destPath, hash: baseline });
            continue;
        }
        manifest.push({ path: destPath, hash: sha256(readFileSync(destFull)) });
    }
    return manifest;
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