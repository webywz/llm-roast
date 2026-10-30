import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(root, "dist/cli.js");
const examples = join(root, "examples");

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

describe("--suite batch mode", () => {
  it("roasts multiple files from directory and emits JSON", () => {
    build();
    const result = run(["--suite", examples, "--json", "--offline"]);
    expect(result.status).toBe(0);
    const json = JSON.parse(result.stdout);
    expect(json.version).toBe("0.1.16");
    expect(json.files).toBeInstanceOf(Array);
    expect(json.files.length).toBeGreaterThanOrEqual(2);
    expect(json.stats).toBeDefined();
    expect(json.stats.count).toBe(json.files.length);
    expect(json.stats.maxScore).toBeGreaterThanOrEqual(0);
    expect(json.stats.avgScore).toBeGreaterThanOrEqual(0);
    expect(json.stats.failCount).toBeGreaterThanOrEqual(0);
  });

  it("roasts multiple files from glob pattern", () => {
    build();
    const result = run(["--suite", "examples/*.md", "--json", "--offline"]);
    expect(result.status).toBe(0);
    const json = JSON.parse(result.stdout);
    expect(json.files).toBeInstanceOf(Array);
    expect(json.files.length).toBeGreaterThanOrEqual(2);
    json.files.forEach((file: any) => {
      expect(file.path).toMatch(/\.md$/);
      expect(file.score).toBeGreaterThanOrEqual(0);
      expect(file.label).toBeDefined();
      expect(file.kind).toMatch(/^(prompt|answer)$/);
      expect(file.wordCount).toBeGreaterThanOrEqual(0);
    });
  });

  it("exits 1 when suite maxScore exceeds --fail-above", () => {
    build();
    const result = run(["--suite", examples, "--json", "--offline", "--fail-above", "50"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/suite maxScore \d+ exceeds --fail-above 50/);
    const json = JSON.parse(result.stdout);
    expect(json.stats.maxScore).toBeGreaterThan(50);
  });

  it("exits 0 when suite maxScore does not exceed --fail-above", () => {
    build();
    const result = run(["--suite", examples, "--json", "--offline", "--fail-above", "100"]);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("exits 2 when no files found", () => {
    build();
    const result = run(["--suite", "nonexistent/*.md", "--json", "--offline"]);
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/no roastable files found/);
  });

  it("exits 2 when only 1 file found", () => {
    build();
    const result = run(["--suite", "examples/clean.txt", "--json", "--offline"]);
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/only 1 file found, need ≥2 files/);
  });

  it("rejects --suite with --prompt or --answer", () => {
    build();
    const result = run(["--suite", examples, "--prompt", "examples/prompt.txt"]);
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/--suite cannot be combined/);
  });

  it("lists --suite in help", () => {
    build();
    const help = run(["--help"]);
    expect(help.status).toBe(0);
    expect(help.stdout).toMatch(/--suite/);
  });

  it("expands brace patterns and roasts multiple files", () => {
    build();
    const result = run(["--suite", "examples/{answer,bad-answer}.md", "--json", "--offline"]);
    expect(result.status).toBe(0);
    const json = JSON.parse(result.stdout);
    expect(json.files).toBeInstanceOf(Array);
    expect(json.files.length).toBe(2);
    expect(json.files[0].path).toMatch(/answer\.md$/);
    expect(json.files[1].path).toMatch(/bad-answer\.md$/);
    expect(json.stats.count).toBe(2);
  });

  it("expands complex brace patterns with wildcards", () => {
    build();
    const result = run(["--suite", "examples/{answer,bad-answer}.md", "--json", "--offline"]);
    expect(result.status).toBe(0);
    const json = JSON.parse(result.stdout);
    expect(json.files.length).toBeGreaterThanOrEqual(2);
    json.files.forEach((file: any) => {
      expect(file.path).toMatch(/\/(answer|bad-answer)\.md$/);
    });
  });
});
