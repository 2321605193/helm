---
name: plan
description: 只规划不执行：需求→探索→规划
argument-hint: <需求描述或需求文件路径>
allowed-tools: [Read, Grep, Glob, Write]
---

<objective>
根据用户提供的需求，探索代码库并生成执行计划，但不修改任何业务代码。
</objective>

<process>
1. Phase 0: 读取或推断需求，生成 prd.md
2. Phase 2: 探索代码库，生成 explore.md
3. Phase 2b: 拆分任务为 Wave，生成 plan.md
</process>

<constraints>
- 禁止修改任何业务代码文件
- 只允许写入 harness/ 和 .harness/ 目录
- 必须包含 Wave 依赖图
</constraints>

<done>
- prd.md 已生成
- explore.md 已生成
- plan.md 包含完整的 Wave 分解
</done>
