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
    expect(help.stdout).toMatch(/--max-annotations/);
    expect(help.stdout).toMatch(/--quiet/);
    expect(help.stdout).toMatch(/GITHUB_STEP_SUMMARY/);
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

  it("rejects non-positive --max-annotations", () => {
    build();
    const result = run(["--offline", "--github", "--max-annotations", "0", answer]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/max-annotations/);
  });

  it("honors --max-annotations with --github", () => {
    build();
    const result = run([
      "--offline",
      "--github",
      "--max-annotations",
      "1",
      answer,
    ]);
    expect(result.status).toBe(0);
    const annLines = result.stdout
      .split("\n")
      .filter((l) => /^::(error|warning|notice) /.test(l));
    expect(annLines).toHaveLength(1);
  });

  it("writes GITHUB_STEP_SUMMARY with --github", () => {
    build();
    const dir = mkdtempSync(join(tmpdir(), "llm-roast-gh-sum-cli-"));
    const sumFile = join(dir, "step_summary.md");
    try {
      const result = run(["--offline", "--github", answer], {
        GITHUB_STEP_SUMMARY: sumFile,
      });
      expect(result.status).toBe(0);
      const body = readFileSync(sumFile, "utf8");
      expect(body).toMatch(/## llm-roast/);
      expect(body).toMatch(/Roast Score/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("--quiet CLI", () => {
  it("suppresses the pretty report with --quiet", () => {
    build();
    const result = run(["--offline", "--quiet", answer]);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).not.toMatch(/Roast Score/);
  });

  it("keeps --json stdout with --quiet", () => {
    build();
    const result = run(["--offline", "--quiet", "--json", answer]);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toHaveProperty("score");
    expect(result.stdout).not.toMatch(/Roast Score/);
  });

  it("keeps --github annotations with --quiet (no pretty group)", () => {
    build();
    const result = run(["--offline", "--github", "--quiet", answer]);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/::(error|warning|notice) /);
    expect(result.stdout).not.toMatch(/::group::llm-roast report/);
    expect(result.stdout).not.toMatch(/::endgroup::/);
  });

  it("writes GITHUB_OUTPUT with --github --quiet", () => {
    build();
    const dir = mkdtempSync(join(tmpdir(), "llm-roast-quiet-out-"));
    const outFile = join(dir, "github_output");
    try {
      const result = run(["--offline", "--github", "--quiet", answer], {
        GITHUB_OUTPUT: outFile,
      });
      expect(result.status).toBe(0);
      const body = readFileSync(outFile, "utf8");
      expect(body).toMatch(/^score=\d+$/m);
      expect(body).toMatch(/^findings=\d+$/m);
      expect(result.stdout).toMatch(/::(error|warning|notice) /);
      expect(result.stdout.includes("::group::")).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("writes GITHUB_STEP_SUMMARY with --github --quiet", () => {
    build();
    const dir = mkdtempSync(join(tmpdir(), "llm-roast-quiet-sum-"));
    const sumFile = join(dir, "step_summary.md");
    try {
      const result = run(["--offline", "--github", "--quiet", answer], {
        GITHUB_STEP_SUMMARY: sumFile,
      });
      expect(result.status).toBe(0);
      const body = readFileSync(sumFile, "utf8");
      expect(body).toMatch(/## llm-roast/);
      expect(result.stdout).not.toMatch(/::group::/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("pins examples workflow to ^0.1.6 with --quiet", () => {
    const example = readFileSync(join(root, "examples/github-actions.yml"), "utf8");
    expect(example).toMatch(/@webywz\/llm-roast@\^0\.1\.5/);
    expect(example).toMatch(/--quiet/);
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      version: string;
    };
    expect(pkg.version).toBe("0.1.6");
  });
});
