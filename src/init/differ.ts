import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { ScanResult, DiffReport } from "./types.js";
import { TEMPLATE_FILES } from "./types.js";
import { sha256 } from "../utils/hash.js";

export function generateDiff(
  scan: ScanResult,
  cwd: string,
  templateDir: string,
): DiffReport {
  const report: DiffReport = {
    newFiles: [],
    updatedFiles: [],
    skippedFiles: [],
    backedUpFiles: [],
  };

  for (const [destPath, srcPath] of TEMPLATE_FILES) {
    const destFull = join(cwd, destPath);
    const tmplFull = join(templateDir, srcPath);

    if (!existsSync(tmplFull)) {
      continue;
    }

    if (!existsSync(destFull)) {
      report.newFiles.push(destPath);
      continue;
    }

    // File exists in both - compare hashes
    const destHash = sha256(readFileSync(destFull));
    const tmplHash = sha256(readFileSync(tmplFull));

    if (destHash === tmplHash) {
      continue;
    }

    // Check if from our manifest (user modified)
    const manifestEntry = scan.existingManifest?.find((e) => e.path === destPath);
    if (manifestEntry) {
      report.skippedFiles.push(destPath);
      report.backedUpFiles.push(destPath);
    } else {
      // User's own file (e.g. their AGENTS.md)
      if (destPath === "AGENTS.md") {
        if (scan.agentsMdContent?.includes("# AGENTS.md")) {
          report.skippedFiles.push(destPath);
        }
      } else if (destPath === "CLAUDE.md") {
        if (scan.claudeMdContent?.includes("# CLAUDE.md")) {
          report.skippedFiles.push(destPath);
        }
      } else {
        report.skippedFiles.push(destPath);
      }
    }
  }

  return report;
}
