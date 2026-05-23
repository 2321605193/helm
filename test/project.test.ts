import assert from "node:assert/strict";
import { resolveProjectCommands, renderProjectEnv } from "../src/init/project.js";

describe("resolveProjectCommands", () => {
  it("prefers a Node project's own package.json scripts over guesses", () => {
    const cmds = resolveProjectCommands("node", { build: "tsc", lint: "eslint src", test: "mocha" });
    assert.equal(cmds.build, "npm run build");
    assert.equal(cmds.lint, "npm run lint");
    assert.equal(cmds.test, "npm test");
  });

  it("falls back to eslint and no test/build when a Node project lacks those scripts", () => {
    const cmds = resolveProjectCommands("node", { start: "node ." });
    assert.equal(cmds.build, null);
    assert.equal(cmds.lint, "npx eslint .");
    assert.equal(cmds.test, null);
    assert.equal(cmds.coverage, "npx c8 --reporter=text-summary npm test");
  });

  it("treats empty/whitespace scripts as absent", () => {
    const cmds = resolveProjectCommands("node", { test: "   ", build: "" });
    assert.equal(cmds.test, null);
    assert.equal(cmds.build, null);
  });

  it("resolves Python tooling", () => {
    const cmds = resolveProjectCommands("python");
    assert.equal(cmds.lint, "ruff check .");
    assert.equal(cmds.test, "pytest");
    assert.equal(cmds.coverage, "pytest --cov");
  });

  it("resolves Rust and Go tooling", () => {
    assert.equal(resolveProjectCommands("rust").test, "cargo test");
    assert.equal(resolveProjectCommands("go").build, "go build ./...");
  });

  it("returns all-null for unknown project types", () => {
    const cmds = resolveProjectCommands("unknown");
    assert.deepEqual(
      { build: cmds.build, lint: cmds.lint, test: cmds.test, coverage: cmds.coverage },
      { build: null, lint: null, test: null, coverage: null },
    );
  });
});

describe("renderProjectEnv", () => {
  it("emits the type and only the non-null commands as sourceable lines", () => {
    const env = renderProjectEnv(resolveProjectCommands("python"));
    assert.match(env, /HELM_PROJECT_TYPE="python"/);
    assert.match(env, /HELM_LINT_CMD="ruff check \."/);
    assert.match(env, /HELM_TEST_CMD="pytest"/);
    // Python has no build command, so the line must be absent (not empty).
    assert.doesNotMatch(env, /HELM_BUILD_CMD=/);
  });

  it("omits every command line for an unknown project but keeps the type", () => {
    const env = renderProjectEnv(resolveProjectCommands("unknown"));
    assert.match(env, /HELM_PROJECT_TYPE="unknown"/);
    assert.doesNotMatch(env, /HELM_(BUILD|LINT|TEST|COVERAGE)_CMD=/);
  });
});
