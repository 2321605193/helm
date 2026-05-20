# CLAUDE.md

## 快速开始

1. 阅读 `AGENTS.md` — 红线规则 + 任务分级（始终遵守）
2. 阅读 `CONTEXT.md` — 项目当前状态
3. 阅读 `harness/commands/*.md` — 可用命令列表
4. 按 `harness/templates/` 中的模板生成任务产物

## 常用操作

- `/harness "需求描述"` — 启动完整 Harness 管道
- `/helm:plan "需求描述"` — 只规划不执行
- `/helm:verify` — 验证当前代码
- `helm gate run --profile standard` — 运行门禁

## 行为约束

- 先读 AGENTS.md 的分级规则，再决定工作量
- 禁止编造测试结果、禁止硬编码密钥、禁止静默吞错
- 每个 Phase 完成后写入状态文件
- Writer 和 Reviewer 使用不同的 Agent
