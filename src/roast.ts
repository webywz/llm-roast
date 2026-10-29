import { createRequire } from "node:module";
import { writeCombinedRoast } from "./copy.js";
import { maybeDeepen } from "./deepen.js";
import { analyzeText } from "./scorer.js";
import { clampScore, clampText, normalizeNewlines, scoreLabel } from "./text.js";
import type { RoastOptions, RoastResult, TargetKind, TargetResult } from "./types.js";

const require = createRequire(import.meta.url);
const VERSION: string = (require("../package.json") as { version: string }).version;

export { VERSION };

export interface DocumentInput {
  text: string;
  kind?: TargetKind | "auto";
  source?: string;
}

export function roastText(text: string, options: RoastOptions = {}): TargetResult {
  const prepared = clampText(normalizeNewlines(text));
  return analyzeText(prepared, options);
}

function combinedScore(targets: TargetResult[]): number {
  if (targets.length === 0) return 0;
  if (targets.length === 1) return targets[0]!.score;
  const prompt = targets.find((t) => t.kind === "prompt");
  const answer = targets.find((t) => t.kind === "answer");
  if (prompt && answer) {
    return clampScore(prompt.score * 0.45 + answer.score * 0.55);
  }
  const weighted =
    targets.reduce((s, t) => s + t.score * Math.max(t.wordCount, 1), 0) /
    targets.reduce((s, t) => s + Math.max(t.wordCount, 1), 0);
  return clampScore(weighted);
}

export function roastDocuments(docs: DocumentInput[], spicy = false): RoastResult {
  const targets = docs.map((d) =>
    roastText(d.text, { kind: d.kind, spicy, source: d.source }),
  );
  const score = combinedScore(targets);
  const result: RoastResult = {
    version: VERSION,
    score,
    label: scoreLabel(score),
    spicy,
    targets,
  };
  if (targets.length === 2) {
    const prompt = targets.find((t) => t.kind === "prompt");
    const answer = targets.find((t) => t.kind === "answer");
    if (prompt && answer) {
      result.summary = writeCombinedRoast(prompt.wordCount, answer.wordCount, spicy, score);
    }
  }
  return result;
}

export async function roastDocumentsAsync(
  docs: DocumentInput[],
  spicy = false,
  deepen = true,
): Promise<RoastResult> {
  const result = roastDocuments(docs, spicy);
  if (deepen) {
    const extra = await maybeDeepen(result, spicy);
    if (extra) result.deepen = extra;
  }
  return result;
}
