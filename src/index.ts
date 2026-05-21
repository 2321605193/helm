import { Command, CommandOpts } from "./commands.js";
import { runInit } from "./init/init.js";

const commands: Record<string, Command> = {
  init: new Command("init", "Initialize Helm environment in current project")
    .option("--dry-run", "Preview changes without applying them")
    .option("--force", "Overwrite existing files (backup first)")
    .action((args: string[], opts: CommandOpts) => {
      const cwd = (args[0] as string) || (opts.dir as string) || process.cwd();
      return runInit(cwd, opts);
    }),
};

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
  } catch (err) {
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

Examples:
  helm init
  helm init /path/to/project
  helm init --dry-run
  helm init --force
`.trim());
}

export { commands };

// Auto-invoke when run directly
main();
