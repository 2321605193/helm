import type { ScanResult, DiffReport } from "./types.js";
/**
 * Three-way diff between the shipped templates, the files on disk, and the
 * baseline hashes recorded in .helm-manifest.json at the last install.
 *
 * The baseline acts as a merge-base: it lets us tell apart "the template moved
 * on but the user never touched their copy" (safe to update) from "the user
 * edited the file" (must not clobber). Without it we can only compare disk vs
 * template, which cannot distinguish those two cases.
 */
export declare function generateDiff(scan: ScanResult, cwd: string, templateDir: string): DiffReport;
//# sourceMappingURL=differ.d.ts.map