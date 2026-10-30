import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { escapeHtml, formatHtml } from "../src/html.js";
import { roastDocuments } from "../src/roast.js";
import { answer, prompt, runCli as run } from "./helpers.js";

const HOSTILE = `As an AI language model, <img src=x onerror="alert(1)"> & </script> studies show.`;

describe("escapeHtml / formatHtml", () => {
  it("escapes angle brackets amp quotes", () => {
    expect(escapeHtml(`<script>alert("x")</script>&'`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;",
    );
  });

  it("emits a self-contained roast report with expected markers", () => {
    const result = roastDocuments([{ text: HOSTILE, kind: "answer", source: "answer.md" }], true);
    const html = formatHtml(result, { locale: "en" });
    expect(html).toMatch(/<!DOCTYPE html>/i);
    expect(html).toMatch(/llm-roast/);
    expect(html).toMatch(/Roast Score/);
    expect(html).toMatch(/THE ROAST/);
    expect(html).toMatch(/TOP FINDINGS/);
    expect(html).toContain(`${result.score}/100`);
    expect(html).toMatch(/spicy/i);
    expect(html).toMatch(/answer\.md/);
    expect(html).not.toMatch(/cdn\.|unpkg|jsdelivr|fonts\.googleapis/i);
    expect(html).not.toMatch(/<script[\s>]/i);
    expect(html).not.toMatch(/<img src=x/);
    expect(html).toMatch(/&lt;img src=x/);
    expect(html).toMatch(/onerror=&quot;/);
    expect(html).not.toMatch(/\sonerror="/i);
  });

  it("uses zh labels when locale is zh", () => {
    const result = roastDocuments([{ text: HOSTILE, kind: "answer", source: "x.md" }]);
    const html = formatHtml(result, { locale: "zh" });
    expect(html).toMatch(/吐槽分/);
    expect(html).toMatch(/lang="zh"/);
  });
});

describe("--html CLI", () => {
  it("lists --html in help", () => {
    const help = run(["--help"]);
    expect(help.status).toBe(0);
    expect(help.stdout).toMatch(/--html \[path\]/);
    expect(help.stdout).toMatch(/Self-contained HTML report/);
    expect(help.stdout).toMatch(/--html and --json cannot share stdout/);
  });

  it("prints HTML to stdout when path is omitted", () => {
    const result = run(["--html", "--offline", answer]);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/<!DOCTYPE html>/i);
    expect(result.stdout).toMatch(/llm-roast/);
    expect(result.stdout).toMatch(/Roast Score/);
    expect(result.stdout).toMatch(/\d+\/100/);
    expect(result.stdout).not.toMatch(/cdn\.|unpkg|jsdelivr|fonts\.googleapis/i);
    expect(result.stdout).not.toMatch(/─{10,}/);
  });

  it("writes HTML to path and does not dump it to stdout", () => {
    const dir = mkdtempSync(join(tmpdir(), "llm-roast-html-"));
    const outFile = join(dir, "nested", "report.html");
    try {
      const result = run(["--offline", "--html", outFile, answer]);
      expect(result.status).toBe(0);
      expect(result.stderr).toMatch(/wrote html report to/);
      expect(result.stderr).toMatch(new RegExp(outFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      expect(result.stdout).not.toMatch(/<!DOCTYPE html>/i);
      expect(existsSync(outFile)).toBe(true);
      const content = readFileSync(outFile, "utf8");
      expect(content).toMatch(/<!DOCTYPE html>/i);
      expect(content).toMatch(/Roast Score/);
      expect(content).toMatch(/llm-roast/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects --html together with --json", () => {
    const result = run(["--offline", "--html", "--json", answer]);
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/cannot be combined with --json/);
    expect(result.stdout).not.toMatch(/<!DOCTYPE html>/i);
  });

  it("keeps default pretty stdout when --html is absent", () => {
    const result = run(["--offline", answer]);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/Roast Score/);
    expect(result.stdout).not.toMatch(/<!DOCTYPE html>/i);
    expect(result.stdout).toMatch(/THE ROAST/);
  });

  it("keeps --json stdout unchanged when --html is absent", () => {
    const result = run(["--offline", "--json", answer]);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toHaveProperty("score");
    expect(parsed).toHaveProperty("targets");
    expect(result.stdout).not.toMatch(/<!DOCTYPE html>/i);
  });

  it("suppresses pretty report with --html --quiet (HTML still on stdout)", () => {
    const result = run(["--offline", "--quiet", "--html", "--no-color", answer]);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/<!DOCTYPE html>/i);
    expect(result.stdout).not.toMatch(/─{10,}/);
    expect(result.stderr).not.toMatch(/Roast Score/);
  });

  it("keeps --github annotations with --html (annotations on stderr)", () => {
    const result = run(["--offline", "--github", "--html", "--no-color", answer]);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/<!DOCTYPE html>/i);
    expect(result.stdout).not.toMatch(/::(error|warning|notice) /);
    expect(result.stderr).toMatch(/::(error|warning|notice) /);
    expect(result.stdout).not.toMatch(/::group::/);
  });

  it("keeps --github annotations + STEP_SUMMARY with --html path", () => {
    const dir = mkdtempSync(join(tmpdir(), "llm-roast-html-gh-"));
    const htmlFile = join(dir, "roast.html");
    const sumFile = join(dir, "step_summary.md");
    const outFile = join(dir, "github_output");
    try {
      const result = run(["--offline", "--github", "--html", htmlFile, answer], {
        GITHUB_STEP_SUMMARY: sumFile,
        GITHUB_OUTPUT: outFile,
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/::(error|warning|notice) /);
      expect(result.stdout).not.toMatch(/<!DOCTYPE html>/i);
      expect(readFileSync(htmlFile, "utf8")).toMatch(/<!DOCTYPE html>/i);
      expect(readFileSync(sumFile, "utf8")).toMatch(/## llm-roast/);
      expect(readFileSync(outFile, "utf8")).toMatch(/^score=\d+$/m);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("suppresses pretty group with --html path --github --quiet", () => {
    const dir = mkdtempSync(join(tmpdir(), "llm-roast-html-quiet-"));
    const htmlFile = join(dir, "roast.html");
    try {
      const result = run(["--offline", "--github", "--quiet", "--html", htmlFile, answer]);
      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/::(error|warning|notice) /);
      expect(result.stdout).not.toMatch(/::group::/);
      expect(result.stdout).not.toMatch(/<!DOCTYPE html>/i);
      expect(result.stderr).not.toMatch(/wrote html report to/);
      expect(readFileSync(htmlFile, "utf8")).toMatch(/llm-roast/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("writes pretty to --out and HTML to stdout", () => {
    const dir = mkdtempSync(join(tmpdir(), "llm-roast-html-out-"));
    const outFile = join(dir, "report.txt");
    try {
      const result = run(["--offline", "--html", "--out", outFile, answer]);
      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/<!DOCTYPE html>/i);
      expect(readFileSync(outFile, "utf8")).toMatch(/Roast Score/);
      expect(readFileSync(outFile, "utf8")).not.toMatch(/<!DOCTYPE html>/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("writes HTML for --prompt + --answer", () => {
    const result = run(["--offline", "--html", "--prompt", prompt, "--answer", answer]);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/<!DOCTYPE html>/i);
    expect(result.stdout).toMatch(/PROMPT/);
    expect(result.stdout).toMatch(/ANSWER/);
  });
});
