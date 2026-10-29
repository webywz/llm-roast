import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("bin entry", () => {
  it("keeps a node shebang on the CLI source", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../src/cli.ts"),
      "utf8",
    );
    expect(src.startsWith("#!/usr/bin/env node\n")).toBe(true);
  });
});
