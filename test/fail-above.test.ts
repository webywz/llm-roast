import { describe, expect, it } from "vitest";
import { answer, runCli as run } from "./helpers.js";

describe("--fail-above CI gate", () => {
  it("exits 1 when score exceeds the threshold", () => {
    const fail = run(["--offline", "--fail-above", "50", answer]);
    expect(fail.status).toBe(1);
    expect(fail.stderr).toMatch(/roast score \d+ exceeds --fail-above 50/);
    expect(fail.stdout.length).toBeGreaterThan(0);
  });

  it("exits 0 when score does not exceed the threshold", () => {
    const ok = run(["--offline", "--fail-above", "100", answer]);
    expect(ok.status).toBe(0);
    expect(ok.stderr).toBe("");
  });

  it("lists --fail-above in help", () => {
    const help = run(["--help"]);
    expect(help.status).toBe(0);
    expect(help.stdout).toMatch(/--fail-above/);
  });
});
