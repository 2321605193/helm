import assert from "node:assert/strict";
import { Command } from "../src/commands.js";

describe("Command option parsing", () => {
  it("normalizes kebab-case flags to camelCase keys", async () => {
    let seen: Record<string, unknown> = {};
    const cmd = new Command("init", "")
      .option("--dry-run", "")
      .action(async (_args, opts) => {
        seen = opts;
      });

    await cmd.run(["--dry-run"]);

    // The action reads opts.dryRun, so the parser must expose it under that key.
    assert.equal(seen.dryRun, true);
  });

  it("keeps single-word flags as-is", async () => {
    let seen: Record<string, unknown> = {};
    const cmd = new Command("init", "")
      .option("--force", "")
      .action(async (_args, opts) => {
        seen = opts;
      });

    await cmd.run(["--force"]);

    assert.equal(seen.force, true);
  });

  it("captures flag values and positionals", async () => {
    let seen: Record<string, unknown> = {};
    let pos: string[] = [];
    const cmd = new Command("task", "")
      .option("--level", "")
      .action(async (args, opts) => {
        seen = opts;
        pos = args;
      });

    await cmd.run(["build login", "--level", "M"]);

    assert.equal(seen.level, "M");
    assert.deepEqual(pos, ["build login"]);
  });
});
