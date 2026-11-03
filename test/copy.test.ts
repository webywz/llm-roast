import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { main } from "../src/cli.js";
import { formatPretty } from "../src/format.js";
import { roastDocuments } from "../src/roast.js";
import { answer, examples } from "./helpers.js";

async function captureIo<T>(fn: () => Promise<T>): Promise<{
  value: T;
  stdout: string;
  stderr: string;
}> {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const outWrite = process.stdout.write.bind(process.stdout);
  const errWrite = process.stderr.write.bind(process.stderr);
  process.stdout.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
    stdoutChunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
    if (typeof rest[0] === "function") (rest[0] as () => void)();
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
    stderrChunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
    if (typeof rest[0] === "function") (rest[0] as () => void)();
    return true;
  }) as typeof process.stderr.write;
  try {
    const value = await fn();
    return {
      value,
      stdout: stdoutChunks.join(""),
      stderr: stderrChunks.join(""),
    };
  } finally {
    process.stdout.write = outWrite;
    process.stderr.write = errWrite;
  }
}

async function runMain(
  args: string[],
  copyToClipboard?: (text: string) => boolean,
): Promise<{ status: number; stdout: string; stderr: string; calls: string[] }> {
  const calls: string[] = [];
  const deps = copyToClipboard
    ? {
        copyToClipboard: (text: string) => {
          calls.push(text);
          return copyToClipboard(text);
        },
      }
    : {};
  const captured = await captureIo(() => main(["--offline", ...args], deps));
  return {
    status: captured.value,
    stdout: captured.stdout,
    stderr: captured.stderr,
    calls,
  };
}

describe("--copy CLI wiring", () => {
  it("lists --copy in help", async () => {
    const result = await runMain(["--help"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/--copy/);
    expect(result.stdout).toMatch(/clipboard/);
    expect(result.stdout).toMatch(/skip silently/);
  });

  it("copies the pretty roast report, not JSON / HTML chrome", async () => {
    const result = await runMain(["--copy", "--quiet", answer], () => true);
    expect(result.status).toBe(0);
    expect(result.calls).toHaveLength(1);
    const copied = result.calls[0] ?? "";
    expect(copied).toMatch(/Roast Score/);
    expect(copied).toMatch(/\d+\/100/);
    expect(copied).toMatch(/llm-roast/);
    expect(copied).not.toMatch(/^\s*\{/);
    expect(copied).not.toMatch(/<!DOCTYPE html>/i);
    expect(copied).not.toMatch(/::(error|warning|notice|group|endgroup)/);
    expect(copied).not.toMatch(/\x1b\[/);
    expect(result.stderr).not.toMatch(/clipboard/i);
  });

  it("with --json still copies the pretty report, not the JSON blob", async () => {
    const result = await runMain(["--copy", "--json", answer], () => true);
    expect(result.status).toBe(0);
    expect(result.calls).toHaveLength(1);
    const copied = result.calls[0] ?? "";
    expect(copied).toMatch(/Roast Score/);
    expect(copied).not.toMatch(/"targets"/);
    const payload = JSON.parse(result.stdout) as { score: number };
    expect(payload).toHaveProperty("score");
    expect(copied).toContain(`${payload.score}/100`);
  });

  it("with --html still copies the pretty report, not HTML", async () => {
    // `--html` must follow the file so the fixture is not taken as the HTML path.
    const result = await runMain(["--copy", answer, "--html"], () => true);
    expect(result.status).toBe(0);
    expect(result.calls).toHaveLength(1);
    expect(result.calls[0]).toMatch(/Roast Score/);
    expect(result.calls[0]).not.toMatch(/<!DOCTYPE html>/i);
    expect(result.stdout).toMatch(/<!DOCTYPE html>/i);
  });

  it("clipboard failure is silent success", async () => {
    const result = await runMain(["--copy", "--quiet", answer], () => false);
    expect(result.status).toBe(0);
    expect(result.calls).toHaveLength(1);
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toMatch(/clipboard/i);
  });

  it("clipboard throw is silent success", async () => {
    const result = await runMain(["--copy", "--quiet", answer], () => {
      throw new Error("clipboard exploded");
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toMatch(/clipboard/i);
  });

  it("without --copy does not invoke the clipboard", async () => {
    let called = false;
    const withSpy = await runMain(["--quiet", answer], () => {
      called = true;
      return true;
    });
    expect(withSpy.status).toBe(0);
    expect(called).toBe(false);

    const baseline = await runMain(["--quiet", answer]);
    expect(baseline.status).toBe(0);
    expect(withSpy.stdout).toBe(baseline.stdout);
    expect(withSpy.stderr).toBe(baseline.stderr);
  });

  it("copies after the roast is built with --github / --fail-above / --html path", async () => {
    const dir = mkdtempSync(join(tmpdir(), "llm-roast-copy-"));
    try {
      const result = await runMain(
        [
          "--copy",
          "--github",
          "--quiet",
          "--fail-above",
          "100",
          "--html",
          join(dir, "report.html"),
          answer,
        ],
        () => true,
      );
      expect(result.status).toBe(0);
      expect(result.calls).toHaveLength(1);
      expect(result.calls[0]).toMatch(/Roast Score/);
      expect(result.calls[0]).not.toMatch(/::(error|warning|notice)/);
      expect(result.stderr).not.toMatch(/clipboard/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("honors --locale zh in the copied pretty report", async () => {
    const result = await runMain(["--copy", "--quiet", "--locale", "zh", answer], () => true);
    expect(result.status).toBe(0);
    expect(result.calls).toHaveLength(1);
    expect(result.calls[0]).toMatch(/吐槽分/);
  });

  it("suite mode accepts --copy as a silent no-op", async () => {
    let called = false;
    const result = await runMain(["--copy", "--suite", examples, "--json"], () => {
      called = true;
      return true;
    });
    expect(result.status).toBe(0);
    expect(called).toBe(false);
    const payload = JSON.parse(result.stdout) as { version: string };
    expect(payload.version).toBe("0.1.20");
  });

  it("copied text matches color-free formatPretty", async () => {
    const result = await runMain(["--copy", "--quiet", answer], () => true);
    expect(result.status).toBe(0);
    const roasted = roastDocuments(
      [
        {
          text: readFileSync(answer, "utf8"),
          kind: "auto",
          source: "answer.md",
        },
      ],
      false,
    );
    const pretty = formatPretty(roasted, { color: false, locale: "en", spicy: false });
    expect(result.calls[0]).toBe(pretty);
  });
});
