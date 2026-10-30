import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(root, "dist/cli.js");
const answer = join(root, "examples/answer.md");

function build(): void {
  const tsc = join(root, "node_modules/typescript/bin/tsc");
  execFileSync(process.execPath, [tsc, "-p", "tsconfig.json"], { cwd: root });
}

function run(args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
}

describe("--fail-above CI gate", () => {
  it("exits 1 when score exceeds the threshold", () => {
    build();
    const fail = run(["--offline", "--fail-above", "50", answer]);
    expect(fail.status).toBe(1);
    expect(fail.stderr).toMatch(/roast score \d+ exceeds --fail-above 50/);
    expect(fail.stdout.length).toBeGreaterThan(0);
  });

  it("exits 0 when score does not exceed the threshold", () => {
    build();
    const ok = run(["--offline", "--fail-above", "100", answer]);
    expect(ok.status).toBe(0);
    expect(ok.stderr).toBe("");
  });

  it("lists --fail-above in help", () => {
    build();
    const help = run(["--help"]);
    expect(help.status).toBe(0);
    expect(help.stdout).toMatch(/--fail-above/);
  });
});
