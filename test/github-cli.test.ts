import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
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

function run(args: string[], env: Record<string, string | undefined> = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", ...env },
  });
}

describe("--github CLI", () => {
  it("lists --github in help", () => {
    build();
    const help = run(["--help"]);
    expect(help.status).toBe(0);
    expect(help.stdout).toMatch(/--github/);
    expect(help.stdout).toMatch(/GitHub Actions annotations/);
  });

  it("emits Actions annotations with --github", () => {
    build();
    const result = run(["--offline", "--github", answer]);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/::(error|warning|notice) /);
    expect(result.stdout).toMatch(/::group::llm-roast report/);
    expect(result.stdout).toMatch(/::endgroup::/);
  });

  it("keeps --json stdout clean when combined with --github", () => {
    build();
    const result = run(["--offline", "--github", "--json", answer]);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toHaveProperty("score");
    expect(result.stderr).toMatch(/::(error|warning|notice) /);
    expect(result.stdout).not.toMatch(/::(error|warning|notice) /);
  });

  it("combines --github with --fail-above (annotations + exit 1)", () => {
    build();
    const result = run(["--offline", "--github", "--fail-above", "50", answer]);
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/::(error|warning|notice) /);
    expect(result.stderr).toMatch(/exceeds --fail-above 50/);
  });

  it("writes GITHUB_OUTPUT fields with --github", () => {
    build();
    const dir = mkdtempSync(join(tmpdir(), "llm-roast-gh-cli-"));
    const outFile = join(dir, "github_output");
    try {
      const result = run(["--offline", "--github", answer], {
        GITHUB_OUTPUT: outFile,
      });
      expect(result.status).toBe(0);
      const body = readFileSync(outFile, "utf8");
      expect(body).toMatch(/^score=\d+$/m);
      expect(body).toMatch(/^label=.+$/m);
      expect(body).toMatch(/^findings=\d+$/m);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
