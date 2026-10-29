import { describe, expect, it } from "vitest";
import { formatJson, formatPretty } from "../src/format.js";
import { roastDocuments } from "../src/roast.js";

const TEXT = `As an AI language model, in today's digital age we should delve into this.`;

describe("formatters", () => {
  it("pretty output includes score, roast, and findings", () => {
    const result = roastDocuments([{ text: TEXT, kind: "answer", source: "answer.md" }]);
    const pretty = formatPretty(result, { color: false });
    expect(pretty).toMatch(/llm-roast/);
    expect(pretty).toMatch(/Roast Score/);
    expect(pretty).toMatch(/THE ROAST/);
    expect(pretty).toMatch(/TOP FINDINGS/);
    expect(pretty).toMatch(/answer\.md/);
    expect(pretty).toContain(String(result.score));
  });

  it("json output is parseable and includes findings with lines", () => {
    const result = roastDocuments([{ text: TEXT, kind: "answer", source: "x.md" }], true);
    const parsed = JSON.parse(formatJson(result)) as typeof result;
    expect(parsed.spicy).toBe(true);
    expect(parsed.score).toBe(result.score);
    expect(parsed.targets[0]?.findings.length).toBeGreaterThan(0);
    expect(parsed.targets[0]?.findings[0]?.line).toBeGreaterThanOrEqual(1);
  });
});
