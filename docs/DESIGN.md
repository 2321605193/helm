# Helm - AI Agent 编排引擎设计文档

> 版本: v0.1.0-draft
> 创建日期: 2026-05-20
> 状态: 设计中

## 项目定位

**Helm** 是一个 Harness-Driven 的 AI Agent 编排工具。核心理念：从"约束 Agent 行为"升级为"设计 Agent 的完整工作环境"。

在 Agent 接触代码之前，Helm 先为其搭建一个隔离的工作沙箱（Harness），包含标准化的文档模板、适配任务复杂度的门禁配置、精确的上下文预算和工具白名单。Agent 在这个预定义的环境中工作，天然产出可追溯、可验证的产物。

**类比**：不是交通警察（违规时拦下），而是修建专用车道（让违规不可能发生）。

## 灵感来源

| 项目 | 借鉴的模式 |
|------|-----------|
| [OpenHarness](https://github.com/HKUDS/OpenHarness) | Tool 标准化抽象、PermissionChecker 权限模型、QueryEngine Agent Loop、Provider Profile 管理、Dry-run 安全预览 |
| [REDPILL](../redpill) | Command-as-Prompt、Wave 并行执行、薄编排器 |
| [SCALE ENGINE](../scale-engine) | G0-G8 质量门禁、FSM 状态机、自适应治理、自进化闭环 |
| [OMC](../oh-my-claudecode) | Agent Tier 模型路由、Writer/Reviewer 分离、Git Trailer |
| [PROJECT-SCAFFOLD](../project-scaffold) | 任务分级(S/M/L/CRITICAL)、Makefile 统一入口、红线规则 |

---

## 借鉴 OpenHarness 的改造方案

### 总体思路

OpenHarness 是一个**完整的 Agent 运行时**（自己调模型、执行工具），Helm 的定位是**Agent 操作代码前的编排层**（设计工作空间、预定义环境）。两者互补，不需要复制 OpenHarness 的模型调用层，而是借鉴其**治理模式、工具定义、权限体系**来增强 Helm。

核心公式：**Harness = Tools + Knowledge + Observation + Action + Permissions**

### 改造一：工具标准化抽象（借鉴 `BaseTool` + `ToolRegistry`）

**OpenHarness 的做法**：所有工具继承 `BaseTool`，声明 `name`、`description`、`input_model`（Pydantic schema），统一返回 `ToolResult { output, is_error, metadata }`。`ToolRegistry` 管理所有工具并提供 API schema 转换。

**Helm 的映射**：Helm 的 Gate 脚本就是"工具"。当前 Gate 只是 `bash "xxx.sh"` 调用，没有标准化描述。

**改造方案**：

```typescript
// src/tool/base.ts
export interface ToolDefinition {
  name: string;              // e.g. "G4-lint"
  description: string;        // "Run ESLint/Ruff on the project"
  command: string;            // The shell command or inline script
  isReadOnly: boolean;        // Read-only tools don't mutate files
  projectType?: string[];     // ["node", "python"] - 哪些项目类型适用
  timeoutMs?: number;         // Default 60000
}

export interface ToolResult {
  tool: string;
  passed: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  metadata: Record<string, unknown>;
}

// src/tool/registry.ts — 统一管理 + 自动生成 Gate 脚本
export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition) { this.tools.set(tool.name, tool); }
  get(name: string): ToolDefinition | undefined { return this.tools.get(name); }
  list(): ToolDefinition[] { return [...this.tools.values()]; }
  forProjectType(type: string): ToolDefinition[] {
    return this.list().filter(t => !t.projectType || t.projectType.includes(type));
  }
}
```

**收益**：Gate 脚本不再需要手动写 `.sh`，而是从 `ToolDefinition` 自动生成 + 可动态注册新工具。

### 改造二：权限检查器（借鉴 `PermissionChecker` + `PathRule`）

**OpenHarness 的做法**：
- 内置 `SENSITIVE_PATH_PATTERNS` 硬编码保护（`*/.ssh/*`、`*/.aws/credentials` 等）
- `PathRule` 支持 glob 匹配 allow/deny 规则
- 三级权限模式：`FULL_AUTO`、`PLAN`（只读）、`DEFAULT`（需确认）
- 区分 `read-only` 工具（永远允许）和 `mutating` 工具（需确认）

**Helm 的映射**：Helm 的 Gate 系统缺少权限层级。当前 Gate 要么 pass 要么 fail，没有"这个工具是否被允许运行"的概念。

**改造方案**：

```typescript
// src/gate/permission-checker.ts
const SENSITIVE_PATTERNS = [
  "*/.env*", "*/.ssh/*", "*/.aws/credentials",
  "*/node_modules/.cache/*",  // 不监控构建缓存
];

export type PermissionMode = "auto" | "interactive" | "strict";

export interface PathRule {
  pattern: string;
  allow: boolean;
}

export interface ToolAllowlist {
  mode: PermissionMode;
  allowedTools: string[];      // 白名单
  deniedTools: string[];       // 黑名单
  pathRules: PathRule[];       // 路径级规则
}

export function checkPermission(
  tool: string,
  filePath: string | undefined,
  config: ToolAllowlist,
  isReadOnly: boolean,
): { allowed: boolean; reason: string } {
  // 1. 敏感路径硬编码保护（防御 prompt injection）
  if (filePath && isSensitivePath(filePath)) {
    return { allowed: false, reason: `${filePath} is a sensitive path` };
  }
  // 2. 显式黑名单
  if (config.deniedTools.includes(tool)) {
    return { allowed: false, reason: `${tool} is denied` };
  }
  // 3. 白名单命中
  if (config.allowedTools.includes(tool)) return { allowed: true, reason: "allowlisted" };
  // 4. 只读工具永远允许
  if (isReadOnly) return { allowed: true, reason: "read-only" };
  // 5. auto 模式全部允许
  if (config.mode === "auto") return { allowed: true, reason: "auto mode" };
  // 6. strict 模式默认拒绝
  return { allowed: false, reason: "requires confirmation" };
}
```

**收益**：Helm 可以为不同安全等级的任务配置不同的工具白名单。S 级任务自动执行，CRITICAL 级任务需要人工确认高风险操作。

### 改造三：Agent Loop 引擎（借鉴 `QueryEngine`）

**OpenHarness 的做法**：`QueryEngine` 持有对话历史 + 工具注册表 + 权限检查器，循环调用模型 → 解析 tool_call → 权限检查 → 执行工具 → 把结果加回对话 → 继续循环，直到无更多 tool_call 或达到 max_turns。

**Helm 的映射**：Helm 的 FSM 状态机已经有状态转换能力，但缺少"在某个状态下自动循环执行子步骤"的能力。

**改造方案**：在 FSM 之上加一个 **StepRunner**，每个 FSM 状态对应一组要执行的步骤，StepRunner 依次执行并收集证据：

```typescript
// src/engine/step-runner.ts
export interface Step {
  id: string;
  name: string;
  tool: string;           // ToolRegistry 中的工具名
  args?: Record<string, unknown>;
  condition?: (ctx: ExecutionContext) => boolean;  // 是否执行
  onResult?: (result: ToolResult, ctx: ExecutionContext) => void;
}

export interface ExecutionContext {
  taskDir: string;
  harnessDir: string;
  cwd: string;
  artifacts: Map<string, ToolResult>;  // 已收集的产物
}

export class StepRunner {
  constructor(
    private registry: ToolRegistry,
    private permissions: PermissionChecker,
  ) {}

  async run(steps: Step[], ctx: ExecutionContext): Promise<StepReport[]> {
    const report: StepReport[] = [];
    for (const step of steps) {
      if (step.condition && !step.condition(ctx)) continue;

      const tool = this.registry.get(step.tool)!;
      const perm = this.permissions.check(tool.name, undefined, false);
      if (!perm.allowed) {
        report.push({ step: step.id, status: "skipped", reason: perm.reason });
        continue;
      }

      const result = await executeTool(tool, step.args, ctx);
      ctx.artifacts.set(step.id, result);
      step.onResult?.(result, ctx);
      report.push({ step: step.id, status: result.passed ? "passed" : "failed", result });

      if (!result.passed && tool.name.startsWith("G")) {
        break;  // Gate 失败，短路退出
      }
    }
    return report;
  }
}
```

**收益**：FSM 只管"从哪个状态到哪个状态"，StepRunner 负责"这个状态内要做什么"。关注点分离，可测试性更强。

### 改造四：Provider Profile 管理（借鉴 `oh setup` + Profile 系统）

**OpenHarness 的做法**：把不同 AI 后端（Claude API、Codex、OpenAI、Gemini）视为 workflow profile，每个 profile 绑定自己的凭据、模型、base URL。

**Helm 的映射**：Helm 需要对接不同 AI Agent 平台。当前没有 provider 概念。

**改造方案**：

```typescript
// src/provider/types.ts
export type ProviderKind = "claude-code" | "codex" | "gemini-cli" | "cursor" | "opencode";

export interface ProviderProfile {
  name: string;
  kind: ProviderKind;
  configDir: string;         // e.g. "~/.claude", "~/.codex"
  skillDir: string;          // e.g. ".claude/skills/harness"
  model?: string;            // 推荐模型
  features: string[];        // ["subagent", "hooks", "plan-mode", "worktree"]
}

// src/provider/detector.ts
export function detectProviders(cwd: string): ProviderProfile[] {
  const results: ProviderProfile[] = [];
  if (existsSync(join(cwd, ".claude"))) {
    results.push({ name: "Claude Code", kind: "claude-code", configDir: "~/.claude", skillDir: ".claude/skills/harness", features: ["subagent", "hooks", "plan-mode", "worktree"] });
  }
  if (existsSync(join(cwd, ".codex"))) {
    results.push({ name: "Codex", kind: "codex", configDir: "~/.codex", skillDir: ".codex/skills/harness", features: ["subagent", "hooks"] });
  }
  // ... gemini, cursor, opencode
  return results;
}
```

**新增 CLI 命令**：

```bash
helm provider list              # 检测当前项目的 Provider
helm provider use claude-code   # 切换当前 active provider
helm provider generate-skill    # 重新生成所有 Provider 的 SKILL.md
```

**收益**：Helm 可以明确知道当前项目在哪些 Provider 上可用，为每个 Provider 生成适配的技能文件。

### 改造五：Dry-run 扩展到全命令（借鉴 `oh --dry-run`）

**OpenHarness 的做法**：`--dry-run` 不调模型、不执行工具、不启动 subagent，只解析配置、检查认证、列出会用到的 skills/tools/MCP，给出 `ready/warning/blocked` 结论。

**Helm 的映射**：当前只有 `helm init --dry-run`，可以扩展到所有命令。

**改造方案**：全局 `--dry-run` 标志，每个命令在执行前先输出"我会做什么"：

```bash
# 当前已有的
helm init --dry-run              # 预览文件变更

# 新增的
helm task "实现登录" --dry-run    # 预览任务结构（ID、目录、模板列表）
helm gate run --dry-run          # 预览要执行的 Gate 列表 + 命令 + 权限状态
helm execute --dry-run           # 预览 Wave 分解 + 依赖图

# 新增: 全局 dry-run 子命令
helm dry-run                     # 综合检查
  ├── Provider 状态: Claude Code ✓, Codex ✗
  ├── 模板完整性: 5/7 模板存在
  ├── Gate 脚本: 3/8 脚本存在
  ├── 当前任务: idle（无活跃任务）
  └── 结论: warning — 缺少部分模板，建议 helm init
```

### 改造实施路线图

```
Phase 1: 工具标准化（2-3 天）
  ├── 定义 ToolDefinition 接口
  ├── 实现 ToolRegistry
  ├── 将现有 Gate 脚本迁移为 ToolDefinition
  └── Gate 脚本自动生成

Phase 2: 权限系统（1-2 天）
  ├── 实现 PermissionChecker
  ├── 定义 ToolAllowlist 配置格式
  ├── 在 Profile 中绑定 allowlist
  └── Gate Runner 集成权限检查

Phase 3: StepRunner 引擎（2-3 天）
  ├── 实现 Step + StepRunner
  ├── FSM ↔ StepRunner 对接
  ├── 任务状态文件中增加步骤报告
  └── 支持 Gate 失败短路 + 回退

Phase 4: Provider 管理（1-2 天）
  ├── 实现 ProviderProfile 类型
  ├── 实现 Provider 自动检测
  ├── 新增 helm provider 命令
  └── helm init 自动检测 + 生成 Skill

Phase 5: Dry-run 全局扩展（1 天）
  ├── 实现 helm dry-run 综合检查命令
  ├── 所有命令支持 --dry-run
  └── 给出 ready/warning/blocked 结论

Phase 6: 补齐已有设计文档中的缺失（2-3 天）
  ├── 补齐 templates/ 目录（7 个模板文件）
  ├── 补齐 profiles/ 目录（4 个 profile）
  ├── 补齐 gates/ 目录（8 个 Gate 脚本）
  └── 补齐 test/ 目录（至少覆盖 commands + registry）
```

**总计**：约 9-14 天可完成全部改造。

---

## 架构总览

### 六阶段工作流

```
┌─────────────────────────────────────────────────────────┐
│                   用户入口 (CLI / Skill)                  │
│         `helm "实现用户登录"` 或 `/helm:execute`    │
└──────────────────────┬──────────────────────────────────┘
                       │
          ┌────────────▼────────────┐
          │   Phase 0: 需求解析      │  读需求文档 / 用户描述
          │   (Requirement → PRD)    │  输出: prd.md + acceptance criteria
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │   Phase 1: 环境构建       │  ★ Harness Engineering 核心
          │   (Build Workspace)      │  输出: 模板 + 规则 + 门禁 + 上下文
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │   Phase 2: 探索 + 规划    │  代码库探索 → 依赖图 → 任务拆分
          │   (Explore + Plan)       │  输出: explore.md + plan.md (wave模型)
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │   Phase 3: 并行执行       │  Wave 内并行，Wave 间串行
          │   (Execute Waves)        │  输出: 代码 + atomic commits
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │   Phase 4: 验证 + 门禁    │  G0-G7 门禁 + Writer/Reviewer 分离
          │   (Verify + Gates)       │  输出: verification.md + gate reports
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │   Phase 5: 归档 + 进化    │  证据归档 + 教训提取 + 规则沉淀
          │   (Archive + Evolve)     │  输出: summary.md + lessons learned
          └─────────────────────────┘
```

### Harness 环境定义

Agent 开始工作前，Harness 先创建一个隔离的工作沙箱：

```
Harness = {
  工作目录结构:    任务专用的 .harness/task-xxx/ 目录
  文件模板:        explore.md, plan.md, verification.md 等预生成
  行为规则:        AGENTS.md 中的任务级红线
  门禁配置:        gates.json (该任务需要哪些门禁)
  上下文预算:      context-budget.json (always-load vs on-demand)
  工具白名单:      tools-allowlist.json (允许/禁止的工具)
  Git 策略:        commit-convention.json (提交格式、分支策略)
  回滚方案:        rollback.md (如果失败如何恢复)
}
```

---

## 三层交付模式

### 第一层：Project Files（通用层，零安装，所有运行时可用）

纯 Markdown + JSON + Shell 文件，不依赖任何运行时或 CLI。用户只需把这些文件放进项目，Agent 就能按照 Harness 规范工作。

**覆盖范围**：Claude Code、Codex、Gemini CLI、Cursor、Copilot、OpenCode... 所有读项目内 Markdown 文件的 AI 编程工具。

```
项目根目录/
├── AGENTS.md              ← 红线规则 + 任务分级表（始终加载）
├── CLAUDE.md              ← Claude Code 最短入口（可选）
├── harness/               ← Helm 核心目录
│   ├── templates/         ← 文档模板（纯 Markdown，Agent 填空）
│   ├── profiles/          ← 治理 profile（JSON 配置）
│   └── gates/             ← 门禁脚本（Shell 脚本）
├── scripts/               ← 工作流脚本
│   ├── harness-build.sh   ← 构建 Harness 环境
│   └── harness-resume.sh  ← 从检查点恢复
└── Makefile               ← 统一命令入口（可选）
```

### 第二层：CLI 工具（增强层，提供自动化能力）

`helm` CLI 命令，提供自动化能力但不替代 Agent 的思考：

```bash
helm init                    # 初始化当前项目（智能增量）
helm task "实现用户登录"     # 创建任务 + 预填充模板
helm build --level M         # 构建 Harness 环境（Phase 1）
helm gate run --profile std  # 运行门禁
helm status                  # 查看当前状态
helm resume                  # 从检查点恢复
helm upgrade                 # 升级模板到最新版本
```

### 第三层：Runtime-Specific Skills/Commands（原生层）

各运行时的原生技能/命令，由 `helm init` 自动生成：

```
.claude/skills/harness/SKILL.md     ← Claude Code: /harness
.codex/skills/harness/SKILL.md      ← Codex 技能
.gemini/commands/helm.toml       ← Gemini 命令
.cursor/skills/harness/SKILL.md     ← Cursor 技能
```

### 三层关系

| 场景 | 使用方式 |
|------|---------|
| 新项目起步 | `helm init` → 生成第一层文件 |
| 已有项目 | 复制 harness/ 目录，Agent 自动遵守规则 |
| Claude Code | `helm init` 自动生成 .claude/skills/ |
| Codex | `helm init` 自动生成 .codex/skills/ |
| 纯手动 | 直接用第一层文件，告诉 Agent 遵守规范 |
| CI/CD 集成 | `helm gate run --profile standard` |

**核心原则**：Helm 的核心逻辑（模板、规则、门禁定义）必须在第一层的文件中，不依赖 CLI 也不依赖 Skill。CLI 和 Skill 只是"自动化入口"。

---

## 核心设计模式

### 1. Command-as-Prompt（借鉴 REDPILL）

每个 command 是自包含的 Markdown 文件，通过 YAML frontmatter 声明接口，通过 XML 标签定义行为。新增功能只需添加一个 .md 文件。

```markdown
<!-- harness/commands/execute.md -->
---
name: execute
description: 完整 Harness 执行管道：需求→环境→探索→规划→执行→验证→归档
argument-hint: <需求描述或需求文件路径>
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob, Agent]
---

<objective>
根据用户提供的需求，执行完整的 Harness 工作流。
</objective>

<process>
1. Phase 0: 读取或推断需求，生成 prd.md
2. Phase 1: 构建 Harness 环境（模板 + 规则 + 门禁）
3. Phase 2: 探索代码库，生成 explore.md；拆分任务，生成 plan.md
4. Phase 3: 按 Wave 模型并行执行
5. Phase 4: 运行门禁，生成 verification.md
6. Phase 5: 归档证据，提取教训
</process>

<constraints>
- 每个 Phase 完成后必须写入状态文件
- 门禁失败必须回退到执行阶段
- 禁止在没有 explore.md 的情况下生成 plan.md
- Writer 和 Reviewer 必须使用不同的 Agent
</constraints>
```

### 2. FSM 状态机（借鉴 SCALE ENGINE）

文件状态机（JSON 文件，不需要 SQLite），带 guard 验证：

```json
{
  "states": [
    "idle", "parsing_req", "building_harness", "exploring",
    "planning", "executing", "verifying", "archiving", "done", "failed"
  ],
  "transitions": [
    { "from": "idle",            "event": "start",          "to": "parsing_req" },
    { "from": "parsing_req",     "event": "prd_ready",      "to": "building_harness" },
    { "from": "building_harness","event": "harness_ready",   "to": "exploring" },
    { "from": "exploring",       "event": "explore_done",   "to": "planning" },
    { "from": "planning",        "event": "plan_approved",  "to": "executing" },
    { "from": "executing",       "event": "all_waves_done", "to": "verifying" },
    { "from": "verifying",       "event": "gates_passed",   "to": "archiving" },
    { "from": "verifying",       "event": "gates_failed",   "to": "executing" },
    { "from": "archiving",       "event": "archive_done",   "to": "done" },
    { "from": "*",               "event": "critical_error", "to": "failed" }
  ],
  "guards": {
    "plan_approved": "criticApproval === true",
    "gates_passed": "all gateResults passed"
  }
}
```

### 3. Wave 并行执行（借鉴 REDPILL）

plan.md 中的 wave 分解：

```markdown
## Wave 1: 基础设施（可并行）
- [ ] Task 1.1: 创建 User model 和数据库迁移
- [ ] Task 1.2: 创建 Auth middleware 骨架
- [ ] Task 1.3: 创建登录页面 UI 组件

## Wave 2: 集成（依赖 Wave 1）
- [ ] Task 2.1: 连接 User model 到 Auth middleware
- [ ] Task 2.2: 连接登录页面到 Auth API

## Wave 3: 验证（依赖 Wave 2）
- [ ] Task 3.1: 端到端登录测试
- [ ] Task 3.2: 安全扫描（OWASP）
```

### 4. 任务分级 + 自适应治理（借鉴 PROJECT-SCAFFOLD + SCALE ENGINE）

| 级别 | 适用场景 | 门禁 | 模板 | 审批 |
|------|---------|------|------|------|
| **S** | Typo、注释、微小修改 | G4+G5 | 仅 verification.md | 自动 |
| **M** | Bug 修复、小功能 | G1-G5 | 全部模板 | 自动 |
| **L** | 跨模块、架构变更 | G0-G7 | 全部 + 回滚方案 | 确认后执行 |
| **CRITICAL** | 数据、权限、安全、发布 | G0-G8 + 人工 | 全部 + 安全评审 | 人工确认 |

### 5. Writer / Reviewer 分离（借鉴 OMC）

同一个 active context 下禁止自我审批。Writer pass 创建或修改内容，Reviewer pass 在独立通道中评估。

### 6. 原子提交 + Git Trailer（借鉴 REDPILL + OMC）

```
feat(auth): 添加用户登录 API

实现了基于 JWT 的登录认证，包含 password hashing 和 token refresh。

Constraint: 必须支持现有 OAuth 用户的向后兼容
Rejected: session-based auth（不满足无状态要求）
Confidence: high
Scope-risk: 修改了 auth middleware，需回归测试所有认证端点
Not-tested: 并发 token refresh 场景
```

---

## 目录结构

### CLI 项目结构

```
helm/
├── package.json                     ← npm 包定义
├── tsconfig.json                    ← TypeScript 配置
├── README.md                        ← 项目说明
│
├── docs/
│   └── DESIGN.md                    ← 本文件，设计文档
│
├── src/
│   ├── index.ts                     ← CLI 入口
│   │
│   ├── init/                        ← helm init 核心逻辑
│   │   ├── scanner.ts               ← 扫描项目现状
│   │   ├── differ.ts                ← 生成文件差异报告
│   │   ├── installer.ts             ← 执行安装/更新
│   │   └── runtime-detector.ts      ← 检测运行时（.claude/.codex/.gemini）
│   │
│   ├── task/                        ← helm task 命令
│   │   ├── creator.ts               ← 创建任务目录
│   │   └── template-filler.ts       ← 预填充模板
│   │
│   ├── gate/                        ← 门禁系统
│   │   ├── runner.ts                ← 运行门禁脚本
│   │   ├── reporter.ts              ← 生成门禁报告
│   │   └── profiles.ts              ← 治理 profile 定义
│   │
│   ├── fsm/                         ← 状态机
│   │   └── engine.ts                ← FSM 引擎（带 guard）
│   │
│   ├── manifest/                    ← 文件清单管理
│   │   ├── generator.ts             ← 生成 manifest（SHA-256）
│   │   └── verifier.ts              ← 验证文件完整性
│   │
│   └── utils/                       ← 工具函数
│       ├── project-detector.ts      ← 检测项目类型（node/python/...）
│       ├── backup.ts                ← 用户修改备份
│       └── logger.ts                ← 日志
│
├── templates/                       ← Helm 内置模板（安装在项目 harness/ 中）
│   ├── templates/                   ← 文档模板
│   │   ├── prd.md
│   │   ├── explore.md
│   │   ├── plan.md
│   │   ├── verification.md
│   │   └── summary.md
│   ├── profiles/                    ← 治理 profile
│   │   ├── minimal.json             ← S 级
│   │   ├── standard.json            ← M 级
│   │   ├── expanded.json            ← L 级
│   │   └── critical.json            ← CRITICAL 级
│   ├── gates/                       ← 门禁脚本
│   │   ├── G0-build.sh
│   │   ├── G1-explore.sh
│   │   ├── G2-plan.sh
│   │   ├── G3-tdd.sh
│   │   ├── G4-lint.sh
│   │   ├── G5-test.sh
│   │   ├── G6-coverage.sh
│   │   └── G7-security.sh
│   └── base/                        ← 基础文件（安装在项目根目录）
│       ├── AGENTS.md
│       └── CLAUDE.md
│
├── bin/
│   └── helm.js                      ← CLI 可执行文件入口
│
├── test/                            ← 测试
│   ├── init.test.ts
│   ├── gate.test.ts
│   └── fsm.test.ts
│
└── .mocharc.json                    ← 测试配置
```

### 使用 Helm 后的项目结构

```
项目根目录/
├── AGENTS.md                        ← 红线规则 + 任务分级（始终加载）
├── CLAUDE.md                        ← Claude Code 最短入口（可选）
├── CONTEXT.md                       ← 项目当前状态摘要
│
├── harness/                         ← Helm 核心目录（第一层）
│   ├── commands/                    ← Command-as-Prompt 文件
│   │   ├── execute.md               ← /helm:execute
│   │   ├── plan.md                  ← /helm:plan
│   │   ├── verify.md                ← /helm:verify
│   │   └── review.md                ← /helm:review
│   ├── templates/                   ← 文档模板（Agent 填空）
│   │   ├── prd.md
│   │   ├── explore.md
│   │   ├── plan.md
│   │   ├── verification.md
│   │   └── summary.md
│   ├── profiles/                    ← 治理 profile（JSON）
│   │   ├── minimal.json
│   │   ├── standard.json
│   │   ├── expanded.json
│   │   └── critical.json
│   ├── gates/                       ← 门禁脚本
│   │   ├── G0-build.sh
│   │   ├── G1-explore.sh
│   │   ├── G2-plan.sh
│   │   ├── G3-tdd.sh
│   │   ├── G4-lint.sh
│   │   ├── G5-test.sh
│   │   ├── G6-coverage.sh
│   │   └── G7-security.sh
│   └── state/                       ← 运行时状态
│       ├── current-task.json        ← FSM 状态
│       ├── progress.json            ← Wave 进度
│       └── evidence/                ← 门禁证据
│
├── .harness/tasks/                  ← 每个任务一个目录
│   └── 2026-05-20-user-login/
│       ├── prd.md                   ← Phase 0 产物
│       ├── harness-built.json       ← Phase 1 产物（环境快照）
│       ├── explore.md               ← Phase 2 产物
│       ├── plan.md                  ← Phase 2 产物（含 wave 分解）
│       ├── verification.md          ← Phase 4 产物
│       ├── gate-reports/            ← Phase 4 产物（门禁报告）
│       └── summary.md               ← Phase 5 产物
│
├── scripts/                         ← 工作流脚本
│   ├── harness-build.sh             ← 构建 Harness 环境
│   ├── harness-resume.sh            ← 从检查点恢复
│   └── gates/                       ← 门禁脚本（链接到 harness/gates/）
│
├── Makefile                         ← 统一命令入口（可选）
│
├── .claude/skills/harness/          ← 由 helm init 自动生成
│   └── SKILL.md
├── .codex/skills/harness/           ← 由 helm init 自动生成
│   └── SKILL.md
└── .harness-manifest.json           ← 安装清单（SHA-256）
```

---

## `helm init` 智能初始化

### 核心算法

```
helm init 执行流程:

1. 扫描项目现状
   ├── 已有 AGENTS.md？   → 读取内容，检测是否有 Harness 规则
   ├── 已有 CLAUDE.md？   → 读取内容，检测是否引用了 harness/
   ├── 已有 harness/ 目录？ → 对比 manifest，找出新增/变更文件
   ├── 已有 scripts/？     → 同上
   ├── 是 TypeScript/JavaScript 项目？ → 生成 tsconfig 相关的门禁
   ├── 是 Python 项目？    → 生成 pytest/ruff 相关的门禁
   └── 有 package.json？   → 检测已有 scripts（test/lint）

2. 生成差异报告
   ├── 需要新增的文件列表
   ├── 需要更新的文件列表（用户未修改的模板文件）
   └── 用户已修改的文件列表（不覆盖，提示合并）

3. 执行操作
   ├── 创建缺失的目录
   ├── 写入新增的文件
   ├── 更新未修改的模板（保留用户修改的）
   └── 注入 AGENTS.md/CLAUDE.md 中的 Harness 规则片段
```

### 项目状态 → 行为映射

| 项目状态 | helm init 的行为 |
|---------|-------------------|
| 空目录 | 创建全部文件: AGENTS.md, CLAUDE.md, harness/, scripts/, Makefile |
| 已有 AGENTS.md | 检测是否包含 Harness 规则段落 → 不含则追加，已含则跳过 |
| 已有 harness/templates | 对比模板 hash → 未修改则覆盖，改过则跳过 + 生成差异提示 |
| 已有 scripts/gates/ | 对比脚本内容 → 未修改则覆盖，改过则保留 + 写新版本到 .harness-new/ |
| harness/ 完整存在 | 检查版本升级，只处理新增/变更文件 |

### 运行时自动检测

```
if (检测到 .claude/ 目录 || CLAUDE_PROJECT) {
  生成 .claude/skills/harness/SKILL.md
  注入 .claude/settings.json 中的 Hooks
}

if (检测到 .codex/ 目录 || CODEX_HOME) {
  生成 .codex/skills/harness/SKILL.md
  注入 .codex/hooks.json
}

if (检测到 .gemini/ 目录) {
  生成 .gemini/commands/helm.toml
}

if (检测到 .cursor/ 目录) {
  生成 .cursor/skills/harness/SKILL.md
}
```

### 冲突处理策略（借鉴 REDPILL）

1. **安装前备份用户修改**: 对比 manifest 中的 SHA-256 哈希与当前磁盘文件，如果不同则备份到 `.helm-backups/`
2. **幂等目录创建**: 目录不存在才创建，不覆盖已有内容
3. **settings.json 合并**: 追加新 Hook，不覆盖非 Helm 配置；解析失败则跳过
4. **清理孤儿文件**: 删除旧版本遗留的已废弃文件

---

## 项目类型自适应

`helm init` 时自动检测项目类型，生成对应的门禁命令：

```typescript
function detectProjectType(cwd): string {
  const files = {
    'package.json': 'node',
    'pyproject.toml': 'python',
    'Cargo.toml': 'rust',
    'go.mod': 'go',
    'pom.xml': 'java',
    'Gemfile': 'ruby',
  };
  for (const [file, type] of Object.entries(files)) {
    if (existsSync(join(cwd, file))) return type;
  }
  return 'unknown';
}
```

各类型对应的门禁：

```json
// Node.js 项目
{
  "G4-lint.sh": "npx eslint .",
  "G5-test.sh": "npm test",
  "G6-coverage.sh": "npx c8 --reporter=text npm test"
}

// Python 项目
{
  "G4-lint.sh": "ruff check .",
  "G5-test.sh": "pytest",
  "G6-coverage.sh": "pytest --cov --cov-report=text"
}
```

---

## FSM 状态定义

完整状态转换表：

```
状态              │ 触发事件          │ 下一状态          │ 产出物
──────────────────┼───────────────────┼───────────────────┼─────────────────
idle              │ start             │ parsing_req       │ -
parsing_req       │ prd_ready        │ building_harness  │ prd.md
building_harness  │ harness_ready    │ exploring         │ harness-built.json
exploring         │ explore_done     │ planning          │ explore.md
planning          │ plan_approved    │ executing         │ plan.md
executing         │ all_waves_done   │ verifying         │ 代码 + commits
verifying         │ gates_passed     │ archiving         │ verification.md
verifying         │ gates_failed     │ executing         │ (回退重做)
archiving         │ archive_done     │ done              │ summary.md
*                 │ critical_error   │ failed            │ error.log
```

---

## 开发路径

```
Phase 1: 项目骨架 + 模板引擎
  ├── CLI 脚手架（TypeScript）
  ├── helm init 命令（空目录创建完整结构）
  ├── 所有模板文件（Markdown）
  ├── 所有 profile 配置（JSON）
  ├── 所有门禁脚本（Shell）
  └── AGENTS.md 基础版本

Phase 2: 智能初始化
  ├── helm init 增量模式（已有项目检测）
  ├── 项目类型自适应（Node/Python/...）
  ├── 运行时自动检测（.claude/.codex/...）
  ├── Manifest 系统（SHA-256 清单）
  └── 用户修改备份机制

Phase 3: 任务管理
  ├── helm task 命令
  ├── 任务目录创建 + 模板预填充
  ├── FSM 状态机（文件状态机）
  └── 状态持久化 + 检查点恢复

Phase 4: 门禁系统
  ├── 门禁运行引擎
  ├── 门禁报告生成
  └── Profile 切换（minimal/standard/expanded/critical）

Phase 5: Wave 并行执行
  ├── plan.md 中 wave 依赖解析
  ├── 按依赖顺序并行执行
  └── 进度追踪 + 状态更新

Phase 6: Command-as-Prompt + Skill 适配
  ├── Command 文件（execute/plan/verify/review）
  ├── Claude Code Skill 生成
  ├── Codex Skill 生成
  └── Gemini/Cursor 适配
```

---

## CLI 命令参考

```bash
# 初始化（幂等，增量，安全）
helm init                      # 当前项目初始化
helm init --force              # 强制覆盖（提示备份）
helm init --dry-run            # 预览变更，不执行

# 任务管理
helm task "描述" --level M     # 创建任务（S/M/L/CRITICAL）
helm task list                 # 列出所有任务
helm task show <id>            # 查看任务详情

# 工作流
helm build                     # 构建 Harness 环境（Phase 1）
helm explore                   # 探索代码库（Phase 2a）
helm plan                      # 生成执行计划（Phase 2b）
helm execute                   # 执行 Waves（Phase 3）
helm verify                    # 运行验证（Phase 4）

# 门禁
helm gate run --profile standard   # 运行门禁
helm gate status                   # 查看门禁状态

# 状态
helm status                    # 查看当前任务状态
helm resume                    # 从检查点恢复

# 维护
helm upgrade                   # 升级模板到最新版本
helm manifest verify           # 验证文件完整性
```

---

## 关键约束

1. **核心逻辑在文件中**：模板、规则、门禁定义必须在第一层文件中，不依赖 CLI
2. **幂等**：`helm init` 执行多次不破坏已有文件
3. **不覆盖用户修改**：对比 SHA-256，用户改过的文件保留 + 生成差异提示
4. **Writer/Reviewer 分离**：同一 context 不自我审批
5. **门禁失败回退**：验证失败必须回退到执行阶段
6. **每个 Phase 有产物**：没有结构化文档的 Phase 不算完成
7. **原子提交**：每个 task 完成后立即 git commit
