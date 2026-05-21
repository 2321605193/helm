import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import type { TaskState } from "../fsm/types.js";
import { createFsm } from "../fsm/engine.js";
import { loadProfile } from "../gate/runner.js";

export interface CreateTaskOptions {
  level?: "S" | "M" | "L" | "CRITICAL";
  cwd?: string;
}

export function createTask(
  title: string,
  harnessDir: string,
  opts: CreateTaskOptions = {},
): TaskState {
  const level = opts.level ?? "M";
  const cwd = opts.cwd ?? process.cwd();
  const profileName = profileNameForLevel(level);
  const profile = loadProfile(profileName, harnessDir);

  const slug = title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
  const dateStr = new Date().toISOString().slice(0, 10);
  const taskId = `${dateStr}-${slug}`;
  const tasksDir = join(cwd, ".harness", "tasks");
  const taskDir = join(tasksDir, taskId);

  mkdirSync(taskDir, { recursive: true });

  const fsm = createFsm("idle");
  fsm.save(taskDir);

  const now = new Date().toISOString();
  const state: TaskState = {
    id: taskId,
    title,
    level,
    profile,
    stateMachine: fsm.state,
    taskDir,
    createdAt: now,
    updatedAt: now,
    waves: [],
  };

  writeFileSync(join(taskDir, "task.json"), JSON.stringify(state, null, 2) + "\n");

  // Pre-fill templates if profile specifies them
  if (profile) {
    const templatesDir = join(harnessDir, "templates");
    for (const tmpl of profile.templates) {
      const srcPath = join(templatesDir, `${tmpl}.md`);
      const destPath = join(taskDir, `${tmpl}.md`);
      if (existsSync(srcPath) && !existsSync(destPath)) {
        mkdirSync(dirname(destPath), { recursive: true });
        writeFileSync(destPath, readFileSync(srcPath, "utf-8"));
      }
    }
  }

  console.log(`\nTask created: ${taskId}`);
  console.log(`  Level: ${level}`);
  console.log(`  Profile: ${profileName}`);
  console.log(`  Directory: ${taskDir}`);

  return state;
}

export function loadTask(taskDir: string): TaskState | null {
  const taskPath = join(taskDir, "task.json");
  if (!existsSync(taskPath)) return null;
  return JSON.parse(readFileSync(taskPath, "utf-8")) as TaskState;
}

export function saveTask(state: TaskState): void {
  state.updatedAt = new Date().toISOString();
  writeFileSync(join(state.taskDir, "task.json"), JSON.stringify(state, null, 2) + "\n");
}

export function listTasks(cwd: string): TaskState[] {
  const tasksDir = join(cwd, ".harness", "tasks");
  if (!existsSync(tasksDir)) return [];

  const entries = readdirSync(tasksDir).filter((e: string) => {
    const full = join(tasksDir, e);
    return existsSync(join(full, "task.json"));
  });

  return entries
    .map((e: string) => loadTask(join(tasksDir, e)))
    .filter(Boolean) as TaskState[];
}

function profileNameForLevel(level: "S" | "M" | "L" | "CRITICAL"): string {
  switch (level) {
    case "S":
      return "minimal";
    case "M":
      return "standard";
    case "L":
      return "expanded";
    case "CRITICAL":
      return "critical";
  }
}
