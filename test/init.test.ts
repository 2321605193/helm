import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../src/init/init.js";
import { TEMPLATE_FILES } from "../src/init/types.js";
import type { ManifestEntry } from "../src/init/types.js";

let dirs: string[] = [];

function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "helm-init-"));
  dirs.push(d);
  return d;
}

function readManifest(cwd: string): ManifestEntry[] {
  return JSON.parse(readFileSync(join(cwd, ".helm-manifest.json"), "utf-8"));
}

// runInit is chatty; mute it so test output stays readable.
async function silent<T>(fn: () => Promise<T>): Promise<T> {
  const log = console.log;
  const warn = console.warn;
  console.log = () => {};
  console.warn = () => {};
  try {
    return await fn();
  } finally {
    console.log = log;
    console.warn = warn;
  }
}

afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});

describe("runInit (manifest + force, e2e on real templates)", () => {
  it("writes a manifest covering the FULL set of managed files, not just new ones", async () => {
    const cwd = tmp();
    await silent(() => runInit(cwd));

    const manifest = readManifest(cwd);
    // Every managed file got created, so the manifest must list all of them.
    assert.equal(manifest.length, TEMPLATE_FILES.length);

    const paths = new Set(manifest.map((e) => e.path));
    for (const [dest] of TEMPLATE_FILES) {
      assert.ok(existsSync(join(cwd, dest)), `${dest} should exist on disk`);
      assert.ok(paths.has(dest), `${dest} should be recorded in the manifest`);
    }
  });

  it("is idempotent: a second run keeps the full manifest and changes nothing", async () => {
    const cwd = tmp();
    await silent(() => runInit(cwd));
    const first = readManifest(cwd);

    await silent(() => runInit(cwd));
    const second = readManifest(cwd);

    assert.deepEqual(second, first);
  });

  it("does not overwrite a user-modified file on a plain re-run", async () => {
    const cwd = tmp();
    await silent(() => runInit(cwd));

    const target = join(cwd, "AGENTS.md");
    writeFileSync(target, "USER EDITED CONTENT");

    await silent(() => runInit(cwd));

    // The user's edit survives, and the manifest still carries the original
    // baseline (not the user's hash), so it stays a conflict next time too.
    assert.equal(readFileSync(target, "utf-8"), "USER EDITED CONTENT");
    const entry = readManifest(cwd).find((e) => e.path === "AGENTS.md");
    assert.ok(entry, "AGENTS.md baseline should be preserved in the manifest");
  });

  it("generates harness/project.env with commands resolved from the project type", async () => {
    const cwd = tmp();
    writeFileSync(
      join(cwd, "package.json"),
      JSON.stringify({ name: "demo", scripts: { test: "mocha", lint: "eslint ." } }),
    );

    await silent(() => runInit(cwd));

    const env = readFileSync(join(cwd, "harness", "project.env"), "utf-8");
    assert.match(env, /HELM_PROJECT_TYPE="node"/);
    assert.match(env, /HELM_TEST_CMD="npm test"/); // resolved from the package's own script
    assert.match(env, /HELM_LINT_CMD="npm run lint"/);
  });

  it("preserves a user-edited project.env on a plain re-run (seed-once)", async () => {
    const cwd = tmp();
    writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: "demo", scripts: { test: "mocha" } }));
    await silent(() => runInit(cwd));

    const envPath = join(cwd, "harness", "project.env");
    writeFileSync(envPath, 'HELM_TEST_CMD="my custom test"\n');

    await silent(() => runInit(cwd));

    assert.equal(readFileSync(envPath, "utf-8"), 'HELM_TEST_CMD="my custom test"\n');
  });

  it("--force regenerates project.env", async () => {
    const cwd = tmp();
    writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: "demo", scripts: { test: "mocha" } }));
    await silent(() => runInit(cwd));

    const envPath = join(cwd, "harness", "project.env");
    writeFileSync(envPath, "STALE\n");

    await silent(() => runInit(cwd, { force: true }));

    assert.match(readFileSync(envPath, "utf-8"), /HELM_TEST_CMD="npm test"/);
  });

  it("--force backs up and overwrites a user-modified file", async () => {
    const cwd = tmp();
    await silent(() => runInit(cwd));

    const target = join(cwd, "AGENTS.md");
    const original = readFileSync(target, "utf-8");
    writeFileSync(target, "USER EDITED CONTENT");

    await silent(() => runInit(cwd, { force: true }));

    // File restored to the shipped template...
    assert.equal(readFileSync(target, "utf-8"), original);
    // ...and the user's version was backed up first.
    const backups = readdirSync(join(cwd, ".helm-backups"));
    assert.ok(backups.length > 0, "a backup should have been written");
    const backed = readFileSync(join(cwd, ".helm-backups", backups[0]), "utf-8");
    assert.equal(backed, "USER EDITED CONTENT");
  });
});
