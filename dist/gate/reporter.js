import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
export function generateGateReport(report, taskDir) {
    const reportDir = join(taskDir, "gate-reports");
    mkdirSync(reportDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const reportPath = join(reportDir, `gate-report-${timestamp}.md`);
    const content = buildGateReportMarkdown(report);
    writeFileSync(reportPath, content);
    return reportPath;
}
export function buildGateReportMarkdown(report) {
    const lines = [
        `# Gate Report — ${report.profile}`,
        "",
        `**Task ID**: ${report.taskId}`,
        `**Started**: ${report.startedAt}`,
        `**Completed**: ${report.completedAt}`,
        `**Overall**: ${report.overall}`,
        "",
        "## Results",
        "",
        "| Gate | Status | Duration |",
        "|------|--------|----------|",
    ];
    for (const r of report.results) {
        const status = r.passed ? "passed" : "failed";
        const durationSec = (r.durationMs / 1000).toFixed(1);
        lines.push(`| ${r.gate} | ${status} | ${durationSec}s |`);
    }
    // Add detail sections for failed gates
    const failures = report.results.filter((r) => !r.passed);
    if (failures.length > 0) {
        lines.push("", "## Failed Gates Detail", "");
        for (const r of failures) {
            lines.push(`### ${r.gate}`, "");
            if (r.stdout)
                lines.push("```", r.stdout.trim(), "```", "");
            if (r.stderr)
                lines.push("```", r.stderr.trim(), "```", "");
        }
    }
    return lines.join("\n");
}
//# sourceMappingURL=reporter.js.map