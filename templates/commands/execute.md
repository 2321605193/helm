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

<done>
- 所有门禁通过
- verification.md 有实际运行的验证结果
- summary.md 已生成
- 代码已原子提交
</done>
