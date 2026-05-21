import { Command } from "./commands.js";
import { runInit } from "./init/init.js";
import { createTask, listTasks, loadTask } from "./task/creator.js";
import { runGates, loadProfile, listProfiles } from "./gate/runner.js";
import { generateGateReport } from "./gate/reporter.js";
import { existsSync } from "fs";
import { join as pathJoin } from "path";
const LEVELS = ["S", "M", "L", "CRITICAL"];
const DEFAULT_LEVEL = "M";
const commands = {
    init: new Command("init", "Initialize Helm environment in current project")
        .option("--dry-run", "Preview changes without applying them")
        .option("--force", "Overwrite existing files (backup first)")
        .action((args, opts) => {
        const cwd = opts.dir || process.cwd();
        return runInit(cwd, opts);
    }),
    task: new Command("task", "Create a new task")
        .option("--level", `Task level: ${LEVELS.join(", ")} (default: ${DEFAULT_LEVEL})`)
        .option("--list", "List all tasks")
        .option("--show", "Show task details")
        .action(async (args, opts) => {
        const cwd = process.cwd();
        const harnessDir = resolveHarnessDir(cwd);
        if (opts.list) {
            const tasks = listTasks(cwd);
            if (tasks.length === 0) {
                console.log("\nNo tasks found.");
                return;
            }
            console.log("\nTasks:");
            for (const t of tasks) {
                console.log(`  ${t.id} [${t.level}] ${t.title} — ${t.stateMachine.current}`);
            }
            return;
        }
        if (opts.show) {
            const taskId = typeof opts.show === "string" ? opts.show : args[0];
            if (!taskId) {
                console.error("Error: task ID required for --show");
                process.exit(1);
            }
            const tasksDir = `${cwd}/.harness/tasks`;
            const task = loadTask(`${tasksDir}/${taskId}`);
            if (!task) {
                console.error(`Error: task "${taskId}" not found`);
                process.exit(1);
            }
            console.log(`\nTask: ${task.id}`);
            console.log(`  Title: ${task.title}`);
            console.log(`  Level: ${task.level}`);
            console.log(`  State: ${task.stateMachine.current}`);
            console.log(`  Created: ${task.createdAt}`);
            console.log(`  Updated: ${task.updatedAt}`);
            console.log(`  Waves: ${task.waves.length}`);
            console.log(`  Dir: ${task.taskDir}`);
            return;
        }
        const title = args[0];
        if (!title) {
            console.error("Error: task description required");
            console.log("Usage: helm task \"描述\" --level M");
            process.exit(1);
        }
        const level = typeof opts.level === "string" ? opts.level : DEFAULT_LEVEL;
        if (!LEVELS.includes(level)) {
            console.error(`Error: invalid level "${level}". Must be one of: ${LEVELS.join(", ")}`);
            process.exit(1);
        }
        createTask(title, harnessDir, {
            level: level,
            cwd,
        });
    }),
    gate: new Command("gate", "Run quality gates")
        .option("--profile", "Profile name (minimal, standard, expanded, critical)")
        .option("--task", "Task ID to run gates for")
        .action(async (args, opts) => {
        const cwd = process.cwd();
        const harnessDir = resolveHarnessDir(cwd);
        const profileName = opts.profile || "standard";
        const profile = loadProfile(profileName, harnessDir);
        if (!profile) {
            console.error(`Error: profile "${profileName}" not found`);
            console.log(`Available: ${listProfiles(harnessDir).join(", ")}`);
            process.exit(1);
        }
        console.log(`\nRunning gates for profile: ${profileName} (${profile.description})`);
        console.log(`Gates: ${profile.gates.join(", ")}\n`);
        const taskId = opts.task || "cli-run";
        const report = await runGates(profile.gates, harnessDir, cwd, taskId, profileName);
        const reportPath = generateGateReport(report, cwd);
        console.log(`\nReport: ${reportPath}`);
        console.log(`Overall: ${report.overall}`);
        if (report.overall === "failed") {
            process.exit(1);
        }
    }),
    status: new Command("status", "Show current task state")
        .option("--task", "Task ID to show")
        .action(async (args, opts) => {
        const cwd = process.cwd();
        if (opts.task) {
            const tasksDir = `${cwd}/.harness/tasks`;
            const task = loadTask(`${tasksDir}/${opts.task}`);
            if (!task) {
                console.error(`Error: task "${opts.task}" not found`);
                process.exit(1);
            }
            printTaskStatus(task);
            return;
        }
        // Show latest task
        const tasks = listTasks(cwd);
        if (tasks.length === 0) {
            console.log("\nNo tasks. Run `helm task \"描述\"` to create one.");
            return;
        }
        const latest = tasks[tasks.length - 1];
        printTaskStatus(latest);
    }),
};
function printTaskStatus(task) {
    console.log(`\nTask: ${task.id}`);
    console.log(`  Title: ${task.title}`);
    console.log(`  Level: ${task.level}`);
    console.log(`  State: ${task.stateMachine.current}`);
    console.log(`  Updated: ${task.updatedAt}`);
    // Show transition history
    if (task.stateMachine.history.length > 0) {
        console.log("\n  History:");
        for (const h of task.stateMachine.history.slice(-5)) {
            console.log(`    ${h.state} → ${h.event} (${h.at})`);
        }
    }
    // Show waves
    if (task.waves.length > 0) {
        console.log("\n  Waves:");
        for (const w of task.waves) {
            console.log(`    Wave ${w.waveNumber}: ${w.description} [${w.status}]`);
        }
    }
}
function resolveHarnessDir(cwd) {
    const candidates = [
        pathJoin(cwd, "harness"),
        pathJoin(cwd, ".harness"),
    ];
    for (const c of candidates) {
        if (existsSync(c))
            return c;
    }
    console.error("Warning: harness/ directory not found. Run `helm init` first.");
    return candidates[0];
}
export async function main() {
    const args = process.argv.slice(2);
    const cmd = args[0];
    if (!cmd || cmd === "--help" || cmd === "-h") {
        printHelp();
        return;
    }
    const command = commands[cmd];
    if (!command) {
        console.error(`Unknown command: ${cmd}`);
        printHelp();
        process.exit(1);
    }
    try {
        await command.run(args.slice(1));
    }
    catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
    }
}
function printHelp() {
    console.log(`
helm - Harness-Driven AI Agent Orchestrator

Usage: helm <command> [options]

Commands:
  init [dir]              Initialize Helm environment in target directory
    --dir <path>          Target directory (default: current dir)
    --dry-run             Preview changes without applying them
    --force               Overwrite existing files (backup first)

  task "描述"             Create a new task
    --level <S|M|L|CRITICAL>  Task level (default: M)
    --list                List all tasks
    --show <id>           Show task details

  gate                    Run quality gates
    --profile <name>      Profile: minimal, standard, expanded, critical
    --task <id>           Task ID for report

  status                  Show current task state
    --task <id>           Show specific task

Examples:
  helm init
  helm init --dry-run
  helm task "实现用户登录" --level M
  helm task --list
  helm gate run --profile standard
  helm status
`.trim());
}
export { commands };
//# sourceMappingURL=cli.js.map