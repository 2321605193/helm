import { execSync } from "child_process";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
export function loadProfile(name, harnessDir) {
    const profilePath = join(harnessDir, "profiles", `${name}.json`);
    if (!existsSync(profilePath))
        return null;
    return JSON.parse(readFileSync(profilePath, "utf-8"));
}
export function listProfiles(harnessDir) {
    const profilesDir = join(harnessDir, "profiles");
    if (!existsSync(profilesDir))
        return [];
    return readdirSync(profilesDir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(".json", ""));
}
export async function runGate(gateName, gatesDir, cwd, timeoutMs = 60000) {
    const gateScript = findGateScript(gateName, gatesDir);
    const startedAt = Date.now();
    if (!gateScript) {
        return {
            gate: gateName,
            passed: true,
            exitCode: 0,
            stdout: `Gate script not found for ${gateName}, skipping`,
            stderr: "",
            durationMs: Date.now() - startedAt,
        };
    }
    try {
        const output = execSync(`bash "${gateScript}"`, {
            cwd,
            timeout: timeoutMs,
            encoding: "utf-8",
            maxBuffer: 10 * 1024 * 1024,
        });
        return {
            gate: gateName,
            passed: true,
            exitCode: 0,
            stdout: output,
            stderr: "",
            durationMs: Date.now() - startedAt,
        };
    }
    catch (err) {
        const isExecError = err instanceof Error && "status" in err;
        const execErr = err;
        return {
            gate: gateName,
            passed: false,
            exitCode: isExecError ? (execErr.status ?? 1) : 1,
            stdout: isExecError ? (execErr.stdout ?? "") : "",
            stderr: isExecError ? (execErr.stderr ?? String(err)) : String(err),
            durationMs: Date.now() - startedAt,
        };
    }
}
export async function runGates(gateNames, harnessDir, cwd, taskId, profileName, timeoutMs = 60000) {
    const startedAt = new Date().toISOString();
    const gatesDir = join(harnessDir, "gates");
    const results = [];
    for (const name of gateNames) {
        const result = await runGate(name, gatesDir, cwd, timeoutMs);
        results.push(result);
        const icon = result.passed ? "✓" : "✗";
        console.log(`  ${icon} ${name}: ${result.passed ? "passed" : "failed"}`);
        if (!result.passed) {
            const errOutput = result.stderr.slice(0, 200);
            if (errOutput)
                console.log(`    ${errOutput}`);
        }
    }
    const overall = results.every((r) => r.passed)
        ? "passed"
        : results.every((r) => r.exitCode === 0 && r.stdout.includes("skipping"))
            ? "skipped"
            : "failed";
    return {
        taskId,
        profile: profileName,
        startedAt,
        completedAt: new Date().toISOString(),
        results,
        overall,
    };
}
function findGateScript(gateName, gatesDir) {
    const candidates = [
        join(gatesDir, `${gateName}.sh`),
        join(gatesDir, `${gateName}-gate.sh`),
    ];
    for (const c of candidates) {
        if (existsSync(c))
            return c;
    }
    return null;
}
//# sourceMappingURL=runner.js.map