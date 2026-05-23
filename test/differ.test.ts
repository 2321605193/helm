import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { generateDiff } from "../src/init/differ.js";
import type { ScanResult, ManifestEntry } from "../src/init/types.js";
import { sha256 } from "../src/utils/hash.js";

// The single managed file we exercise. differ iterates the full TEMPLATE_FILES
// list but `continue`s for any whose template source is absent, so by creating
// only `base/AGENTS.md` in the fake template dir we isolate the "AGENTS.md" dest.
const DEST = "AGENTS.md";
const SRC = "base/AGENTS.md";

let dirs: string[] = [];

function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "helm-differ-"));
  dirs.push(d);
  return d;
}

function write(root: string, rel: string, content: string): void {
  const full = join(root, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

function makeScan(cwd: string, manifest: ManifestEntry[] | null): ScanResult {
  return {
    cwd,
    isGitRepo: false,
    hasAgentsMd: false,
    agentsMdContent: null,
    hasClaudeMd: false,
    claudeMdContent: null,
    hasHarnessDir: false,
    existingHarnessFiles: [],
    existingScriptsDir: false,
    projectType: "unknown",
    detectedRuntimes: [],
    existingManifest: manifest,
  };
}

afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});

describe("generateDiff (three-way)", () => {
  it("classifies a missing file as new", () => {
    const tmpl = tmp();
    const cwd = tmp();
    write(tmpl, SRC, "TEMPLATE V2");
    // no disk file written

    const diff = generateDiff(makeScan(cwd, null), cwd, tmpl);

    assert.deepEqual(diff.newFiles, [DEST]);
    assert.deepEqual(diff.updatedFiles, []);
    assert.deepEqual(diff.conflictFiles, []);
    assert.deepEqual(diff.unchangedFiles, []);
  });

  it("classifies a file already equal to the template as unchanged", () => {
    const tmpl = tmp();
    const cwd = tmp();
    write(tmpl, SRC, "SAME CONTENT");
    write(cwd, DEST, "SAME CONTENT");

    const diff = generateDiff(makeScan(cwd, null), cwd, tmpl);

    assert.deepEqual(diff.unchangedFiles, [DEST]);
    assert.deepEqual(diff.newFiles, []);
    assert.deepEqual(diff.updatedFiles, []);
    assert.deepEqual(diff.conflictFiles, []);
  });

  it("classifies template-changed + user-untouched (disk == baseline) as update", () => {
    const tmpl = tmp();
    const cwd = tmp();
    write(tmpl, SRC, "TEMPLATE V2");
    write(cwd, DEST, "TEMPLATE V1"); // what we installed last time
    const manifest: ManifestEntry[] = [{ path: DEST, hash: sha256("TEMPLATE V1") }];

    const diff = generateDiff(makeScan(cwd, manifest), cwd, tmpl);

    assert.deepEqual(diff.updatedFiles, [DEST]);
    assert.deepEqual(diff.conflictFiles, []);
    assert.deepEqual(diff.newFiles, []);
    assert.deepEqual(diff.unchangedFiles, []);
  });

  it("classifies a pre-existing file with no manifest entry as conflict (user-owned)", () => {
    const tmpl = tmp();
    const cwd = tmp();
    write(tmpl, SRC, "TEMPLATE V2");
    write(cwd, DEST, "USER'S OWN AGENTS.md"); // we never installed this

    const diff = generateDiff(makeScan(cwd, null), cwd, tmpl);

    assert.deepEqual(diff.conflictFiles, [DEST]);
    assert.deepEqual(diff.updatedFiles, []);
    assert.deepEqual(diff.newFiles, []);
    assert.deepEqual(diff.unchangedFiles, []);
  });

  it("classifies a user-modified file (disk != baseline, disk != template) as conflict", () => {
    const tmpl = tmp();
    const cwd = tmp();
    write(tmpl, SRC, "TEMPLATE V2");
    write(cwd, DEST, "USER EDITED V1.5"); // user changed it after install
    const manifest: ManifestEntry[] = [{ path: DEST, hash: sha256("TEMPLATE V1") }];

    const diff = generateDiff(makeScan(cwd, manifest), cwd, tmpl);

    assert.deepEqual(diff.conflictFiles, [DEST]);
    assert.deepEqual(diff.updatedFiles, []);
  });

  it("ignores managed files whose template source is absent", () => {
    const tmpl = tmp(); // empty template dir, no SRC written
    const cwd = tmp();
    write(cwd, DEST, "anything");

    const diff = generateDiff(makeScan(cwd, null), cwd, tmpl);

    assert.deepEqual(diff.newFiles, []);
    assert.deepEqual(diff.updatedFiles, []);
    assert.deepEqual(diff.conflictFiles, []);
    assert.deepEqual(diff.unchangedFiles, []);
  });
});
