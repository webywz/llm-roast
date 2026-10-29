import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("bin entry", () => {
  it("exposes llm-roast as dist/cli.js (vibe-commit style)", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      bin: Record<string, string>;
    };
    expect(pkg.bin).toEqual({ "llm-roast": "dist/cli.js" });
  });

  it("keeps a node shebang on the CLI source", () => {
    const src = readFileSync(join(root, "src/cli.ts"), "utf8");
    expect(src.startsWith("#!/usr/bin/env node\n")).toBe(true);
  });

  it("keeps a node shebang after tsc emit", () => {
    const tsc = join(root, "node_modules/typescript/bin/tsc");
    execFileSync(process.execPath, [tsc, "-p", "tsconfig.json"], { cwd: root });
    const dist = readFileSync(join(root, "dist/cli.js"), "utf8");
    expect(dist.startsWith("#!/usr/bin/env node\n")).toBe(true);
  });
});
