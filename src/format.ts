import type { FormatOptions, Finding, RoastResult, TargetResult } from "./types.js";
import { getStrings } from "./locale.js";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const MAGENTA = "\x1b[35m";
const CYAN = "\x1b[36m";
const WHITE = "\x1b[37m";
const BG_RED = "\x1b[41m";
const BG_YELLOW = "\x1b[43m";
const BG_GREEN = "\x1b[42m";
const BLACK = "\x1b[30m";

export function wantsColor(explicit?: boolean): boolean {
  if (explicit === false) return false;
  if (typeof explicit === "boolean") return explicit;
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== "0") return true;
  return Boolean(process.stdout.isTTY);
}

function paint(enabled: boolean) {
  const wrap = (code: string) => (s: string) => (enabled ? `${code}${s}${RESET}` : s);
  return {
    bold: wrap(BOLD),
    dim: wrap(DIM),
    red: wrap(RED),
    green: wrap(GREEN),
    yellow: wrap(YELLOW),
    magenta: wrap(MAGENTA),
    cyan: wrap(CYAN),
    white: wrap(WHITE),
    chipRed: (s: string) => (enabled ? `${BG_RED}${WHITE}${BOLD} ${s} ${RESET}` : `[${s}]`),
    chipYellow: (s: string) => (enabled ? `${BG_YELLOW}${BLACK}${BOLD} ${s} ${RESET}` : `[${s}]`),
    chipGreen: (s: string) => (enabled ? `${BG_GREEN}${BLACK}${BOLD} ${s} ${RESET}` : `[${s}]`),
  };
}

function scoreColor(c: ReturnType<typeof paint>, score: number, text: string): string {
  if (score <= 28) return c.green(text);
  if (score <= 68) return c.yellow(text);
  return c.red(text);
}

function bar(score: number, width = 22): string {
  const filled = Math.max(0, Math.min(width, Math.round((score / 100) * width)));
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function kindTag(kind: Finding["kind"]): string {
  switch (kind) {
    case "fluff":
      return "fluff";
    case "hedge":
      return "hedge";
    case "overconfidence":
      return "ego";
    case "hallucination":
      return "vibes";
    case "prompt":
      return "prompt";
    default:
      return kind;
  }
}

function wrap(text: string, width = 78, indent = 0): string {
  const prefix = " ".repeat(indent);
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if (!w) continue;
    const next = current ? `${current} ${w}` : w;
    if (next.length > width - indent && current) {
      lines.push(prefix + current);
      current = w;
    } else {
      current = next;
    }
  }
  if (current) lines.push(prefix + current);
  return lines.join("\n");
}

function scoreChip(c: ReturnType<typeof paint>, score: number): string {
  const label = `${score}/100`;
  if (score <= 28) return c.chipGreen(label);
  if (score <= 68) return c.chipYellow(label);
  return c.chipRed(label);
}

function findingsBlock(
  c: ReturnType<typeof paint>,
  findings: Finding[],
  noFindingsText: string,
  moreFindingsText: (n: number) => string,
  limit = 6,
): string[] {
  if (!findings.length) {
    return [c.dim(`  ${noFindingsText}`)];
  }
  const lines: string[] = [];
  for (const [i, f] of findings.slice(0, limit).entries()) {
    const n = String(i + 1).padStart(2, " ");
    const tag = kindTag(f.kind).padEnd(6, " ");
    lines.push(
      `  ${c.dim(n + ".")} ${c.magenta(tag)} ${c.bold(f.title)} ${c.dim(`+${f.points}`)}`,
    );
    lines.push(c.dim(`      ${f.detail}`));
    if (f.snippet) {
      const loc = f.line ? `L${f.line}` : "L?";
      lines.push(`      ${c.cyan(loc)} ${c.white(f.snippet)}`);
    }
  }
  if (findings.length > limit) {
    lines.push(c.dim(`      ${moreFindingsText(findings.length - limit)}`));
  }
  return lines;
}

function targetBlock(
  c: ReturnType<typeof paint>,
  t: TargetResult,
  strings: ReturnType<typeof getStrings>,
): string {
  const head = [
    `${c.bold(t.kind.toUpperCase())}  ${t.source}  ·  ${t.wordCount} ${strings.words}  ·  ${scoreChip(c, t.score)}  ${c.dim(t.label)}`,
    `  ${scoreColor(c, t.score, bar(t.score))}`,
    "",
    c.bold(`  ${strings.theRoast}`),
    wrap(t.roast, 78, 2),
    "",
    c.bold(`  ${strings.topFindings}`),
    ...findingsBlock(c, t.findings, strings.noFindings, strings.moreFindings),
  ];
  return head.join("\n");
}

export function formatPretty(result: RoastResult, options: FormatOptions = {}): string {
  const locale = options.locale || "en";
  const strings = getStrings(locale);
  const c = paint(wantsColor(options.color));
  const line = c.dim("─".repeat(60));
  const spicyText = result.spicy ? c.red(`  · ${strings.spicy}`) : "";
  const parts: string[] = [
    `${c.bold("🔥 llm-roast")}  ${c.dim(strings.version + result.version)}${spicyText}`,
    line,
    `${c.bold(strings.roastScore)}  ${scoreChip(c, result.score)}  ${scoreColor(c, result.score, bar(result.score))}  ${c.dim(result.label)}`,
  ];
  if (result.summary) {
    parts.push("", wrap(result.summary, 78, 0));
  }
  parts.push("");

  for (const [i, t] of result.targets.entries()) {
    if (i > 0) parts.push("", line, "");
    parts.push(targetBlock(c, t, strings));
  }

  if (result.deepen) {
    parts.push("", line, "", c.bold(`  ${strings.deepen}`), wrap(result.deepen, 78, 2));
  }

  parts.push("", c.dim(`  ${strings.footer}`));
  return parts.join("\n") + "\n";
}

export function formatJson(result: RoastResult): string {
  return JSON.stringify(result, null, 2) + "\n";
}
