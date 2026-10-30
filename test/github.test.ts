import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  annotation,
  appendGitHubJobOutput,
  escapeData,
  escapeProperty,
  formatGitHubAnnotations,
} from "../src/github.js";
import { roastDocuments } from "../src/roast.js";
import type { Finding, RoastResult } from "../src/types.js";

function fixtureFinding(partial: Partial<Finding> & Pick<Finding, "severity" | "title">): Finding {
  return {
    kind: "fluff",
    detail: "detail",
    points: 5,
    hits: 1,
    ...partial,
  };
}

function miniResult(findings: Finding[], score = 60): RoastResult {
  return {
    version: "0.0.0",
    score,
    label: "meh",
    spicy: false,
    targets: [
      {
        kind: "answer",
        source: "answer.md",
        wordCount: 10,
        charCount: 40,
        score,
        label: "meh",
        findings,
        roast: "roast",
      },
    ],
  };
}

describe("github annotations", () => {
  it("escapes workflow command payloads", () => {
    expect(escapeData("a%b\nc\rd")).toBe("a%25b%0Ac%0Dd");
    expect(escapeProperty("file:name,path")).toBe("file%3Aname%2Cpath");
  });

  it("formats a basic annotation line", () => {
    expect(
      annotation("warning", "hello\nworld", { file: "a.txt", line: 3, title: "t:1,2" }),
    ).toBe("::warning file=a.txt,line=3,title=t%3A1%2C2::hello%0Aworld");
  });

  it("maps severity to error / warning / notice", () => {
    const out = formatGitHubAnnotations(
      miniResult([
        fixtureFinding({ severity: "high", title: "High", kind: "hallucination" }),
        fixtureFinding({ severity: "medium", title: "Med", kind: "hedge" }),
        fixtureFinding({ severity: "low", title: "Low", kind: "fluff" }),
      ]),
    );
    expect(out).toMatch(/::error .*::High/);
    expect(out).toMatch(/::warning .*::Med/);
    expect(out).toMatch(/::notice .*::Low/);
    expect(out).toMatch(/::(error|warning|notice) .*title=llm-roast · score::Roast Score/);
  });

  it("bands score into notice / warning / error", () => {
    expect(formatGitHubAnnotations(miniResult([], 10))).toMatch(/^::notice /);
    expect(formatGitHubAnnotations(miniResult([], 55))).toMatch(/^::warning /);
    expect(formatGitHubAnnotations(miniResult([], 80))).toMatch(/^::error /);
  });

  it("emits annotations for the example answer fixture", () => {
    const text = readFileSync(join(process.cwd(), "examples/answer.md"), "utf8");
    const result = roastDocuments([{ text, kind: "answer", source: "answer.md" }]);
    const out = formatGitHubAnnotations(result);
    expect(out).toMatch(/^::(error|warning|notice) /m);
    expect(out).toMatch(/Roast Score \d+\/100/);
    expect(out).toMatch(/llm-roast · score|llm-roast · /);
    for (const line of out.trim().split("\n")) {
      expect(line).toMatch(/^::(error|warning|notice) /);
    }
  });

  it("respects maxAnnotations (anti-spam)", () => {
    const findings = Array.from({ length: 30 }, (_, i) =>
      fixtureFinding({ severity: "low", title: `F${i}`, detail: `d${i}` }),
    );
    const out = formatGitHubAnnotations(miniResult(findings), { maxAnnotations: 5 });
    expect(out.trim().split("\n")).toHaveLength(5);
  });

  it("appends job outputs when GITHUB_OUTPUT is set", () => {
    const dir = mkdtempSync(join(tmpdir(), "llm-roast-gh-"));
    const outFile = join(dir, "github_output");
    const prev = process.env.GITHUB_OUTPUT;
    try {
      process.env.GITHUB_OUTPUT = outFile;
      appendGitHubJobOutput(miniResult([], 42));
      const body = readFileSync(outFile, "utf8");
      expect(body).toMatch(/^score=42$/m);
      expect(body).toMatch(/^label=meh$/m);
      expect(body).toMatch(/^findings=0$/m);
    } finally {
      if (prev === undefined) delete process.env.GITHUB_OUTPUT;
      else process.env.GITHUB_OUTPUT = prev;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
