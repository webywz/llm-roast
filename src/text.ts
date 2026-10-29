const MAX_CHARS = 200_000;

export function clampText(text: string): string {
  if (text.length <= MAX_CHARS) return text;
  return `${text.slice(0, MAX_CHARS)}\n\n[truncated after ${MAX_CHARS} characters]\n`;
}

export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function wordCount(text: string): number {
  const words = text.trim().match(/\S+/g);
  return words ? words.length : 0;
}

export function lineAt(text: string, index: number): number {
  let line = 1;
  const end = Math.min(index, text.length);
  for (let i = 0; i < end; i++) {
    if (text.charCodeAt(i) === 10) line++;
  }
  return line;
}

export function snippetAt(text: string, index: number, max = 108): string {
  const start = text.lastIndexOf("\n", Math.max(0, index - 1)) + 1;
  let end = text.indexOf("\n", index);
  if (end === -1) end = text.length;
  let line = text.slice(start, end).trim();
  if (line.length > max) {
    const rel = index - start;
    const from = Math.max(0, rel - Math.floor(max / 2));
    line = `${from > 0 ? "…" : ""}${line.slice(from, from + max)}${from + max < line.length ? "…" : ""}`;
  }
  return line;
}

export function hash32(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pick<T>(items: readonly T[], seed: number, salt = 0): T {
  if (items.length === 0) {
    throw new Error("pick() called with an empty list");
  }
  const index = (seed + salt * 2654435761) % items.length;
  return items[index] as T;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function nearby(text: string, index: number, window = 100): string {
  const from = Math.max(0, index - window);
  const to = Math.min(text.length, index + window);
  return text.slice(from, to);
}

export function hasGroundingNear(text: string, index: number, window = 110): boolean {
  const slice = nearby(text, index, window).toLowerCase();
  return /\b(according to|source|citation|cited|doi|arxiv|http|https|wikipedia|documentation|rfc\s?\d|based on the|see figure|see table|as shown|references?|survey|paper|study by|census)\b/.test(
    slice,
  );
}

export function hasReferencesSection(text: string): boolean {
  return /\n#{1,4}\s*(references|bibliography|works cited|sources)\b/i.test(`\n${text}`);
}

const PROMPT_NAME = /\bprompt\b/i;
const ANSWER_NAME = /\b(answer|response|completion|output|reply|result)s?\b/i;

const PROMPT_HINTS =
  /\b(you are|act as|your task|system prompt|write a|generate a|i want you to|please (?:write|create|generate|explain)|role:|instructions?:)\b/gi;
const ANSWER_HINTS =
  /\b(as an ai|sure[,!]?\s|here'?s\b|here is\b|certainly[,!]|great question|i hope this helps|as a language model)\b/gi;

export function detectKind(text: string, filename?: string): "prompt" | "answer" {
  const name = filename ?? "";
  if (PROMPT_NAME.test(name) && !ANSWER_NAME.test(name)) return "prompt";
  if (ANSWER_NAME.test(name)) return "answer";

  const head = text.slice(0, 900);
  const promptHits = head.match(PROMPT_HINTS)?.length ?? 0;
  const answerHits = head.match(ANSWER_HINTS)?.length ?? 0;
  if (promptHits > answerHits && promptHits > 0) return "prompt";
  return "answer";
}

export function scoreLabel(score: number): string {
  if (score <= 12) return "uncannily fine";
  if (score <= 28) return "light charring";
  if (score <= 48) return "medium-rare waffle";
  if (score <= 68) return "well-done filler";
  if (score <= 86) return "extra crispy hallucination";
  return "burnt offering";
}

export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
