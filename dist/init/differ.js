import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { TEMPLATE_FILES } from "./types.js";
import { sha256 } from "../utils/hash.js";
/**
 * Three-way diff between the shipped templates, the files on disk, and the
 * baseline hashes recorded in .helm-manifest.json at the last install.
 *
 * The baseline acts as a merge-base: it lets us tell apart "the template moved
 * on but the user never touched their copy" (safe to update) from "the user
 * edited the file" (must not clobber). Without it we can only compare disk vs
 * template, which cannot distinguish those two cases.
 */
export function generateDiff(scan, cwd, templateDir) {
    const report = {
        newFiles: [],
        updatedFiles: [],
        conflictFiles: [],
        unchangedFiles: [],
    };
    const baseline = new Map((scan.existingManifest ?? []).map((e) => [e.path, e.hash]));
    for (const [destPath, srcPath] of TEMPLATE_FILES) {
        const tmplFull = join(templateDir, srcPath);
        if (!existsSync(tmplFull)) {
            // We don't ship this template in the current build — leave it alone.
            continue;
        }
        const templateHash = sha256(readFileSync(tmplFull));
        const destFull = join(cwd, destPath);
        // 1. Absent on disk -> create.
        if (!existsSync(destFull)) {
            report.newFiles.push(destPath);
            continue;
        }
        const diskHash = sha256(readFileSync(destFull));
        // 2. Already equal to the template -> nothing to do.
        if (diskHash === templateHash) {
            report.unchangedFiles.push(destPath);
            continue;
        }
        // 3. Disk differs from template. Use the baseline to decide whether the
        //    difference is ours (template moved on) or theirs (user edited it).
        const baseHash = baseline.get(destPath);
        if (baseHash !== undefined && baseHash === diskHash) {
            // We installed this exact content and the user hasn't touched it since;
            // the template has since changed -> safe to overwrite.
            report.updatedFiles.push(destPath);
        }
        else {
            // No baseline (a pre-existing file we never installed) or the disk no
            // longer matches the baseline (user edited it) -> conflict.
            report.conflictFiles.push(destPath);
        }
    }
    return report;
}
//# sourceMappingURL=differ.js.map