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

describe("--locale", () => {
  it("lists --locale in help", () => {
    build();
    const help = run(["--help"]);
    expect(help.status).toBe(0);
    expect(help.stdout).toMatch(/--locale/);
    expect(help.stdout).toMatch(/<en\|zh>/);
  });

  it("defaults to English labels when --locale is omitted", () => {
    build();
    const result = run(["--offline", answer]);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/Roast Score/);
    expect(result.stdout).toMatch(/THE ROAST/);
    expect(result.stdout).toMatch(/TOP FINDINGS/);
    expect(result.stdout).toMatch(/words/);
  });

  it("prints English labels with --locale en", () => {
    build();
    const result = run(["--offline", "--locale", "en", answer]);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/Roast Score/);
    expect(result.stdout).toMatch(/THE ROAST/);
    expect(result.stdout).toMatch(/TOP FINDINGS/);
    expect(result.stdout).toMatch(/words/);
    expect(result.stdout).toMatch(/Higher score = more roastable/);
  });

  it("prints Chinese labels with --locale zh", () => {
    build();
    const result = run(["--offline", "--locale", "zh", answer]);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/吐槽分/);
    expect(result.stdout).toMatch(/吐槽内容/);
    expect(result.stdout).toMatch(/主要问题/);
    expect(result.stdout).toMatch(/词/);
    expect(result.stdout).toMatch(/分数越高越该被吐槽/);
    // Should NOT contain English labels
    expect(result.stdout).not.toMatch(/Roast Score/);
    expect(result.stdout).not.toMatch(/THE ROAST/);
    expect(result.stdout).not.toMatch(/TOP FINDINGS/);
  });

  it("preserves JSON field names regardless of --locale", () => {
    build();
    const enResult = run(["--offline", "--json", "--locale", "en", answer]);
    const zhResult = run(["--offline", "--json", "--locale", "zh", answer]);
    expect(enResult.status).toBe(0);
    expect(zhResult.status).toBe(0);
    const enJson = JSON.parse(enResult.stdout);
    const zhJson = JSON.parse(zhResult.stdout);
    // JSON structure should be identical
    expect(enJson).toHaveProperty("score");
    expect(enJson).toHaveProperty("label");
    expect(enJson).toHaveProperty("targets");
    expect(zhJson).toHaveProperty("score");
    expect(zhJson).toHaveProperty("label");
    expect(zhJson).toHaveProperty("targets");
    // JSON output should not contain Chinese terminal labels
    expect(enResult.stdout).not.toMatch(/吐槽分/);
    expect(zhResult.stdout).not.toMatch(/吐槽分/);
  });

  it("rejects invalid --locale values", () => {
    build();
    const result = run(["--offline", "--locale", "fr", answer]);
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/--locale must be "en" or "zh"/);
  });

  it("requires a value for --locale", () => {
    build();
    const result = run(["--offline", "--locale"]);
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/--locale requires/);
  });

  it("works with --locale zh and --spicy", () => {
    build();
    const result = run(["--offline", "--locale", "zh", "--spicy", answer]);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/吐槽分/);
    expect(result.stdout).toMatch(/辛辣/);
  });
});
