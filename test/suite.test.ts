import { describe, expect, it } from "vitest";
import { examples, runCli as run } from "./helpers.js";

describe("--suite batch mode", () => {
  it("roasts multiple files from directory and emits JSON", () => {
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
    const result = run(["--suite", examples, "--json", "--offline", "--fail-above", "50"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/suite maxScore \d+ exceeds --fail-above 50/);
    const json = JSON.parse(result.stdout);
    expect(json.stats.maxScore).toBeGreaterThan(50);
  });

  it("exits 0 when suite maxScore does not exceed --fail-above", () => {
    const result = run(["--suite", examples, "--json", "--offline", "--fail-above", "100"]);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("exits 2 when no files found", () => {
    const result = run(["--suite", "nonexistent/*.md", "--json", "--offline"]);
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/no roastable files found/);
  });

  it("exits 2 when only 1 file found", () => {
    const result = run(["--suite", "examples/clean.txt", "--json", "--offline"]);
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/only 1 file found, need ≥2 files/);
  });

  it("rejects --suite with --prompt or --answer", () => {
    const result = run(["--suite", examples, "--prompt", "examples/prompt.txt"]);
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/--suite cannot be combined/);
  });

  it("lists --suite in help", () => {
    const help = run(["--help"]);
    expect(help.status).toBe(0);
    expect(help.stdout).toMatch(/--suite/);
  });

  it("expands brace patterns and roasts multiple files", () => {
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
    const result = run(["--suite", "examples/{answer,bad-answer}.md", "--json", "--offline"]);
    expect(result.status).toBe(0);
    const json = JSON.parse(result.stdout);
    expect(json.files.length).toBeGreaterThanOrEqual(2);
    json.files.forEach((file: any) => {
      expect(file.path).toMatch(/\/(answer|bad-answer)\.md$/);
    });
  });
});
