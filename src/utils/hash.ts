import { createHash } from "crypto";

export function sha256(input: Buffer | string): string {
  const data = typeof input === "string" ? Buffer.from(input, "utf-8") : input;
  return createHash("sha256").update(data).digest("hex").slice(0, 16);
}
