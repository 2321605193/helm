---
name: review
description: 代码审查 — 从质量、安全、性能角度审查代码
argument-hint: <可选：任务 ID 或文件路径>
allowed-tools: [Read, Grep, Glob, Bash]
---

<objective>
从质量、安全、性能角度审查代码变更，生成 review 报告。
</objective>

<process>
1. 读取变更文件（git diff 或指定文件）
2. 检查代码质量（命名、结构、复杂度）
3. 检查安全问题（OWASP Top 10）
4. 检查性能问题（N+1、内存、并发）
5. 生成 review 报告
</process>

<constraints>
- 不修改任何代码
- 审查必须指出具体问题行号和原因
- 区分 blocking（必须修）和 suggestion（建议修）
</constraints>

<done>
- review 报告已生成
- 所有 blocking 问题已列出
</done>
