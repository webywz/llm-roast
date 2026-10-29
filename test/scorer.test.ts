import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { roastDocuments, roastText } from "../src/roast.js";
import { analyzeText, detectKind } from "../src/scorer.js";

const CLEAN = `
Use Node.js 20's built-in test runner. Import \`assert\` from \`node:assert/strict\`
and \`test\` from \`node:test\`. Keep assertions specific: compare status codes,
error messages, and returned shapes. Prefer one behavior per test name.
`.trim();

const FLUFFY = `
As an AI language model, I cannot actually feel, but in today's digital age
it is important to delve into the rich tapestry of modern tooling. Let's explore
this holistic, seamless, cutting-edge landscape and unlock the potential of synergy.
`.trim();

const HEDGEY = `
This might work, or it could potentially fail. It depends. Perhaps you should
consider that in some cases it is possible that the approach, generally speaking,
will not necessarily succeed. Your mileage may vary.
`.trim();

const COCKY = `
This will always work and will never fail. It is a proven fact, undoubtedly the only
correct solution. Everyone knows this is scientifically proven. 100% guaranteed.
`.trim();

const HALLUC = `
According to Smith et al. (2024), 87.3% of developers prefer this. See the official
docs at https://docs.example.com/v99/autoheal and simply call \`cluster.autoHeal()\`.
Studies show this DOI 10.0000/fake is authoritative.
`.trim();

const MESSY_PROMPT = `
You are a senior engineer and also a friendly pirate. Write a comprehensive yet concise
guide. Be brief but cover every edge case in detail. Don't use lists, and bullet the
key points. Output something about distributed systems. Make it fun and strictly
professional. Do not hallucinate, but feel free to invent examples.
`.trim();

describe("analyzeText", () => {
  it("scores empty input at 0 with a void roast", () => {
    const r = roastText("");
    expect(r.score).toBe(0);
    expect(r.wordCount).toBe(0);
    expect(r.findings).toEqual([]);
    expect(r.roast.toLowerCase()).toMatch(/void|empty|vacuum/);
  });

  it("keeps clean technical writing in the safe zone", () => {
    const r = analyzeText(CLEAN, { kind: "answer" });
    expect(r.score).toBeLessThan(25);
    expect(r.findings.filter((f) => f.kind === "hallucination")).toEqual([]);
  });

  it("dunks on classic ChatGPT fluff", () => {
    const r = analyzeText(FLUFFY, { kind: "answer" });
    expect(r.score).toBeGreaterThan(55);
    const titles = r.findings.map((f) => f.title);
    expect(titles.some((t) => /original sin|language model|digital|delve|tapestry/i.test(t))).toBe(
      true,
    );
    expect(r.findings.some((f) => f.kind === "fluff")).toBe(true);
    expect(r.findings[0]?.snippet).toBeTruthy();
    expect(r.findings[0]?.line).toBeGreaterThanOrEqual(1);
  });

  it("detects hedging / weasel piles", () => {
    const r = analyzeText(HEDGEY, { kind: "answer" });
    expect(r.findings.some((f) => f.kind === "hedge")).toBe(true);
    expect(r.score).toBeGreaterThan(20);
    expect(r.score).toBeLessThan(80);
  });

  it("flags ungrounded overconfidence", () => {
    const r = analyzeText(COCKY, { kind: "answer" });
    expect(r.findings.some((f) => f.kind === "overconfidence")).toBe(true);
    expect(r.score).toBeGreaterThan(40);
  });

  it("catches hallucination vibes: citations, fake URLs, stats, invented APIs", () => {
    const r = analyzeText(HALLUC, { kind: "answer" });
    const kinds = r.findings.filter((f) => f.kind === "hallucination");
    expect(kinds.length).toBeGreaterThanOrEqual(3);
    const blob = kinds.map((f) => `${f.title} ${f.detail}`).join("\n");
    expect(blob).toMatch(/citation|footnote|URL|decimal|API|studies/i);
    expect(r.score).toBeGreaterThan(60);
  });

  it("does not treat a cited percentage as a sourceless stat", () => {
    const text =
      "According to the 2024 Stack Overflow survey, 87.3% of respondents use JavaScript. Source: https://survey.stackoverflow.co/2024";
    const r = analyzeText(text, { kind: "answer" });
    expect(r.findings.some((f) => f.title === "decimal of destiny")).toBe(false);
  });

  it("leaves numbered refs alone when a References section exists", () => {
    const text = "See the paper [1] for details.\n\n## References\n[1] Turing, 1950.";
    const r = analyzeText(text, { kind: "answer" });
    expect(r.findings.some((f) => f.title === "footnote to nowhere")).toBe(false);
  });

  it("sniffs prompt contradictions, stacked roles, and missing constraints", () => {
    const r = analyzeText(MESSY_PROMPT, { kind: "prompt" });
    expect(r.kind).toBe("prompt");
    const promptFindings = r.findings.filter((f) => f.kind === "prompt");
    expect(promptFindings.length).toBeGreaterThanOrEqual(2);
    const titles = promptFindings.map((f) => f.title).join(" ");
    expect(titles).toMatch(/short|list|pirate|identity|hallucinate|blank/i);
    expect(r.score).toBeGreaterThan(45);
  });

  it("does not apply prompt-smell rules to answers", () => {
    const r = analyzeText(MESSY_PROMPT, { kind: "answer" });
    expect(r.findings.some((f) => f.kind === "prompt")).toBe(false);
  });

  it("clamps scores to 0–100", () => {
    const r = analyzeText(`${FLUFFY}\n${HALLUC}\n${COCKY}\n${HEDGEY}`, { kind: "answer" });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("is deterministic for the same input", () => {
    const a = roastText(FLUFFY, { kind: "answer", spicy: false });
    const b = roastText(FLUFFY, { kind: "answer", spicy: false });
    expect(a.score).toBe(b.score);
    expect(a.roast).toBe(b.roast);
    expect(a.findings).toEqual(b.findings);
  });

  it("changes tone with --spicy but not the score", () => {
    const mild = roastText(FLUFFY, { kind: "answer", spicy: false });
    const hot = roastText(FLUFFY, { kind: "answer", spicy: true });
    expect(hot.score).toBe(mild.score);
    expect(hot.roast).not.toBe(mild.roast);
  });
});

describe("detectKind", () => {
  it("trusts filenames", () => {
    expect(detectKind("hello", "my-prompt.txt")).toBe("prompt");
    expect(detectKind("hello", "answer.md")).toBe("answer");
  });

  it("falls back to content hints", () => {
    expect(detectKind("You are a helpful tutor. Write a lesson plan.")).toBe("prompt");
    expect(detectKind("Sure! Here's a detailed explanation of TCP.")).toBe("answer");
  });
});

describe("roastDocuments", () => {
  it("combines prompt + answer scores", () => {
    const result = roastDocuments(
      [
        { text: MESSY_PROMPT, kind: "prompt", source: "prompt.txt" },
        { text: HALLUC, kind: "answer", source: "answer.md" },
      ],
      false,
    );
    expect(result.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(result.targets).toHaveLength(2);
    expect(result.summary).toBeTruthy();
    expect(result.score).toBeGreaterThan(40);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(JSON.parse(JSON.stringify(result)).targets[0].findings[0].kind).toBeTruthy();
  });

  it("roasts the bundled examples", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const prompt = readFileSync(join(dir, "../examples/prompt.txt"), "utf8");
    const answer = readFileSync(join(dir, "../examples/answer.md"), "utf8");
    const result = roastDocuments([
      { text: prompt, kind: "prompt", source: "prompt.txt" },
      { text: answer, kind: "answer", source: "answer.md" },
    ]);
    expect(result.score).toBeGreaterThan(60);
    expect(result.targets[1]?.findings.some((f) => f.kind === "fluff")).toBe(true);
    expect(result.targets[1]?.findings.some((f) => f.kind === "hallucination")).toBe(true);
  });
});
