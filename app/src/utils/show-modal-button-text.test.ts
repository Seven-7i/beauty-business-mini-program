import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function collectSourceFiles(directory: URL): URL[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    if (entry.isDirectory()) {
      return collectSourceFiles(child);
    }
    return /\.(?:ts|vue)$/.test(entry.name) ? [child] : [];
  });
}

describe("uni.showModal button text", () => {
  it("keeps mini-program button labels within the four-character platform limit", () => {
    const sourceRoot = new URL("../", import.meta.url);
    const violations: string[] = [];

    for (const file of collectSourceFiles(sourceRoot)) {
      const source = readFileSync(file, "utf8");
      const labels = source.matchAll(
        /\b(?:cancelText|confirmText)\s*:\s*["'`]([^"'`]*)["'`]/g,
      );

      for (const match of labels) {
        const label = match[1];
        if ([...label].length > 4) {
          violations.push(`${fileURLToPath(file)}: "${label}"`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
