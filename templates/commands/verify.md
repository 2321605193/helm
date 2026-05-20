---
name: verify
description: 验证当前代码 — 运行门禁 + 生成验证报告
argument-hint: <可选：任务 ID 或门禁 profile>
allowed-tools: [Read, Bash, Grep, Glob, Write]
---

<objective>
运行门禁验证当前代码质量，生成 verification.md。
</objective>

<process>
1. 读取任务配置（harness/profiles/）
2. 按 profile 运行对应门禁
3. 汇总结果到 verification.md
</process>

<constraints>
- 不修改任何业务代码
- 门禁结果必须真实运行，禁止编造
- 失败的门禁必须如实报告
</constraints>

<done>
- verification.md 已生成
- 所有门禁状态已记录
</done>
