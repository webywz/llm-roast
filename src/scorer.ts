import { ALL_PHRASE_PATTERNS, type PhrasePattern } from "./patterns.js";
import {
  clampScore,
  detectKind,
  escapeRegExp,
  hasGroundingNear,
  hasReferencesSection,
  lineAt,
  nearby,
  scoreLabel,
  snippetAt,
  wordCount,
} from "./text.js";
import type { Finding, FindingKind, TargetKind, TargetResult } from "./types.js";
import { writeRoast } from "./copy.js";

const HEDGE_POINT_CAP = 28;
const FLUFF_POINT_CAP = 48;
const OVERCONF_POINT_CAP = 36;

interface MatchHit {
  index: number;
  text: string;
}

function compile(pattern: PhrasePattern): RegExp {
  const source = pattern.regex ? pattern.phrase : escapeRegExp(pattern.phrase);
  return new RegExp(pattern.regex ? source : `\\b${source}\\b`, "gi");
}

function collectHits(text: string, re: RegExp): MatchHit[] {
  const hits: MatchHit[] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[0] === "") {
      re.lastIndex++;
      continue;
    }
    hits.push({ index: m.index, text: m[0] });
    if (hits.length >= 40) break;
  }
  return hits;
}

function findingFromHits(
  pattern: PhrasePattern,
  hits: MatchHit[],
  text: string,
  extraPoints = 0,
): Finding {
  const first = hits[0];
  const points = Math.min(pattern.points * 4, pattern.points * hits.length) + extraPoints;
  const quoted = first ? `"${first.text}"` : pattern.title;
  const detail =
    hits.length === 1
      ? `Caught ${quoted}.`
      : `Caught ${quoted} ×${hits.length}.`;
  return {
    kind: pattern.kind,
    severity: pattern.severity,
    title: pattern.title,
    detail,
    snippet: first ? snippetAt(text, first.index) : undefined,
    line: first ? lineAt(text, first.index) : undefined,
    points,
    hits: hits.length,
  };
}

function capKind(findings: Finding[], kind: FindingKind, cap: number): void {
  let used = 0;
  for (const f of findings) {
    if (f.kind !== kind) continue;
    const next = Math.min(f.points, Math.max(0, cap - used));
    f.points = next;
    used += next;
  }
}

function hallucinationFindings(text: string, kind: TargetKind): Finding[] {
  const out: Finding[] = [];
  const refs = hasReferencesSection(text);
  const scale = kind === "prompt" ? 0.45 : 1;

  const push = (
    partial: Omit<Finding, "hits"> & { hits?: number },
  ): void => {
    out.push({ hits: 1, ...partial, points: Math.max(1, Math.round(partial.points * scale)) });
  };

  const citationRe =
    /\(([A-Z][A-Za-z'’.-]+(?:\s+(?:and|&)\s+[A-Z][A-Za-z'’.-]+)?(?:\s+et\s+al\.?)?),?\s+(?:19|20)\d{2}\)|\b[A-Z][A-Za-z'’.-]+(?:\s+(?:and|&)\s+[A-Z][A-Za-z'’.-]+)?\s+et\s+al\.?\s*\(\s*(?:19|20)\d{2}\s*\)/g;
  const citations = collectHits(text, citationRe);
  if (citations.length && !refs) {
    const first = citations[0]!;
    push({
      kind: "hallucination",
      severity: "high",
      title: "made-up citation energy",
      detail: `Academic name-drop ${citations.length === 1 ? "once" : `${citations.length} times`} with no references section.`,
      snippet: snippetAt(text, first.index),
      line: lineAt(text, first.index),
      points: Math.min(22, 12 + citations.length * 3),
      hits: citations.length,
    });
  }

  const numbered = collectHits(text, /\[(\d{1,3})\]/g);
  if (numbered.length >= 2 && !refs) {
    const first = numbered[0]!;
    push({
      kind: "hallucination",
      severity: "medium",
      title: "footnote to nowhere",
      detail: `${numbered.length} numbered citations and nowhere to follow them.`,
      snippet: snippetAt(text, first.index),
      line: lineAt(text, first.index),
      points: Math.min(16, 6 + numbered.length * 2),
      hits: numbered.length,
    });
  }

  const urlRe = /\bhttps?:\/\/[^\s)\]>'"]+/gi;
  const fakeHost =
    /example\.(com|org|net)|domain\.com|yourcompany|your-?api|placeholder|foo\.com|bar\.com|baz\.com|test\.com|lorem|ipsum|dummy|fake|localhost|127\.0\.0\.1|link\.com\/url/i;
  const urls = collectHits(text, urlRe);
  const fakeUrls = urls.filter((u) => fakeHost.test(u.text));
  if (fakeUrls.length) {
    const first = fakeUrls[0]!;
    push({
      kind: "hallucination",
      severity: "high",
      title: "URL from a parallel universe",
      detail: `Placeholder or toy URL: ${first.text.replace(/[.,;]+$/, "")}`,
      snippet: snippetAt(text, first.index),
      line: lineAt(text, first.index),
      points: Math.min(20, 10 + fakeUrls.length * 4),
      hits: fakeUrls.length,
    });
  }

  const doiHits = collectHits(text, /\b(?:doi:\s*)?10\.(?:0000|9999)\/\S+/gi);
  if (doiHits.length) {
    const first = doiHits[0]!;
    push({
      kind: "hallucination",
      severity: "high",
      title: "DOI from a cereal box",
      detail: "That DOI prefix is a classic fake.",
      snippet: snippetAt(text, first.index),
      line: lineAt(text, first.index),
      points: 14,
      hits: doiHits.length,
    });
  }

  const arxivHits = collectHits(text, /\barxiv:\s*(?:0000|9999)\.\d+/gi);
  const arxivUrlHits = collectHits(text, /arxiv\.org\/(?:abs|pdf)\/(?:0000|9999|2099)\.\d+/gi);
  const arxiv = [...arxivHits, ...arxivUrlHits];
  if (arxiv.length) {
    const first = arxiv[0]!;
    push({
      kind: "hallucination",
      severity: "high",
      title: "arxiv fan fiction",
      detail: "That preprint ID does not pass the sniff test.",
      snippet: snippetAt(text, first.index),
      line: lineAt(text, first.index),
      points: 14,
      hits: arxiv.length,
    });
  }

  const statsRe =
    /\b(?:exactly\s+|precisely\s+)?(?:\d{1,2}\.\d{1,2}\s*%|\d{1,3}\.\d\s*%|(?:exactly\s+)?\d{1,3}(?:,\d{3})+(?:\.\d+)?)\b/gi;
  const ungroundedStats = collectHits(text, statsRe).filter((h) => !hasGroundingNear(text, h.index));
  if (ungroundedStats.length) {
    const first = ungroundedStats[0]!;
    push({
      kind: "hallucination",
      severity: "high",
      title: "decimal of destiny",
      detail: `Precise figure ${first.text} with no source in sight.`,
      snippet: snippetAt(text, first.index),
      line: lineAt(text, first.index),
      points: Math.min(20, 10 + ungroundedStats.length * 3),
      hits: ungroundedStats.length,
    });
  }

  const studiesRe =
    /\b(?:studies show|research shows|experts say|scientists (?:have )?found|according to (?:a |recent )?stud(?:y|ies))\b/gi;
  const studies = collectHits(text, studiesRe).filter((h) => !hasGroundingNear(text, h.index, 140));
  if (studies.length) {
    const first = studies[0]!;
    push({
      kind: "hallucination",
      severity: "high",
      title: "studies show (which studies?)",
      detail: "Appealed to research without naming any.",
      snippet: snippetAt(text, first.index),
      line: lineAt(text, first.index),
      points: Math.min(18, 9 + studies.length * 3),
      hits: studies.length,
    });
  }

  const inventedApi = collectHits(
    text,
    /\b(?:simply|just|you can(?: simply)?) (?:call|invoke|use|run) `[^`]{3,80}`|\bthe `[^`]{3,60}` (?:API|endpoint|SDK|method|function)\b|\b(?:undocumented|secret|hidden) (?:API|endpoint|parameter)\b/gi,
  );
  if (inventedApi.length) {
    const first = inventedApi[0]!;
    push({
      kind: "hallucination",
      severity: "high",
      title: "invented API",
      detail: "Sounds like an SDK method that shipped in a dream.",
      snippet: snippetAt(text, first.index),
      line: lineAt(text, first.index),
      points: Math.min(20, 11 + inventedApi.length * 3),
      hits: inventedApi.length,
    });
  }

  const officialDocs = collectHits(
    text,
    /\b(?:official (?:docs?|documentation)|as documented in)(?:\s+\w+){0,6}(?!\s+\S*https?:)/gi,
  ).filter((h) => !/https?:/i.test(nearby(text, h.index, 80)));
  if (officialDocs.length && fakeUrls.length === 0) {
    const first = officialDocs[0]!;
    push({
      kind: "hallucination",
      severity: "medium",
      title: "docs that live in its head",
      detail: "Cited official documentation without a link.",
      snippet: snippetAt(text, first.index),
      line: lineAt(text, first.index),
      points: 8,
      hits: officialDocs.length,
    });
  }

  return out;
}

const CONTRADICTIONS: Array<{ a: RegExp; b: RegExp; title: string; detail: string }> = [
  {
    a: /\b(concise|brief|short|terse|one[- ]sentence)\b/i,
    b: /\b(comprehensive|detailed|in[- ]depth|thorough|exhaustive|cover everything|every edge case)\b/i,
    title: "short and also a novel",
    detail: "Asked for brevity and encyclopedic coverage in the same breath.",
  },
  {
    a: /\b(don'?t use lists|no lists|do not use (?:a )?list|no bullets?)\b/i,
    b: /\b(bullet(?:ed)?|list the|make a list|enumerate)\b/i,
    title: "lists are forbidden / required",
    detail: "Banned lists and then ordered a list.",
  },
  {
    a: /\b(be creative|get creative|use your imagination)\b/i,
    b: /\b(follow (?:this |the )?exactly|verbatim|word for word|do not deviate)\b/i,
    title: "jazz recital with sheet music glued down",
    detail: "Creative, but also do not deviate. Pick one.",
  },
  {
    a: /\b(formal|professional|serious tone)\b/i,
    b: /\b(fun(?:ny)?|casual|goofy|like a pirate|slang)\b/i,
    title: "boardroom pirate",
    detail: "Tone instructions are having a custody battle.",
  },
  {
    a: /\b(beginner|eli5|simple(?: terms)?|for kids)\b/i,
    b: /\b(expert(?:-level)?|advanced|senior|PhD|production[- ]grade)\b/i,
    title: "ELI5 with a PhD",
    detail: "Audience is both a beginner and a principal engineer.",
  },
  {
    a: /\b(no code|don'?t (?:write|include) code|without code)\b/i,
    b: /\b(write code|include code|code sample|implement)\b/i,
    title: "code / no code",
    detail: "Wanted code and also wanted none.",
  },
  {
    a: /\b(do not hallucinate|don'?t invent|no made-up)\b/i,
    b: /\b(feel free to invent|make (?:something )?up|invent examples?)\b/i,
    title: "don't hallucinate, except please do",
    detail: "Forbade invention and invited it.",
  },
];

function promptSmellFindings(text: string): Finding[] {
  const out: Finding[] = [];
  const lower = text.toLowerCase();

  for (const pair of CONTRADICTIONS) {
    const a = pair.a.exec(text);
    const b = pair.b.exec(text);
    if (a && b && a.index !== undefined && b.index !== undefined) {
      const first = a.index < b.index ? a : b;
      out.push({
        kind: "prompt",
        severity: "high",
        title: pair.title,
        detail: pair.detail,
        snippet: snippetAt(text, first.index),
        line: lineAt(text, first.index),
        points: 14,
        hits: 2,
      });
    }
  }

  const roleRe = /\b(?:you are|act as|pretend (?:you(?:['’]re| are)|to be)|role:\s*)([^\n.,;]{3,60})/gi;
  const roles: string[] = [];
  let rm: RegExpExecArray | null;
  const roleFirstIndex: number[] = [];
  while ((rm = roleRe.exec(text)) !== null) {
    const role = (rm[1] ?? "").trim().toLowerCase();
    if (role && !roles.includes(role)) {
      roles.push(role);
      roleFirstIndex.push(rm.index);
    }
    if (roles.length >= 6) break;
  }
  if (roles.length >= 2) {
    const idx = roleFirstIndex[0] ?? 0;
    out.push({
      kind: "prompt",
      severity: "high",
      title: "identity pile-up",
      detail: `Stacked ${roles.length} roles: ${roles.slice(0, 3).map((r) => `"${r.trim()}"`).join(", ")}${roles.length > 3 ? "…" : ""}.`,
      snippet: snippetAt(text, idx),
      line: lineAt(text, idx),
      points: 10 + Math.min(8, (roles.length - 2) * 3),
      hits: roles.length,
    });
  }

  const isTask = /\b(write|create|generate|explain|summarize|list|draft|design|implement|analyze)\b/i.test(text);
  if (isTask && wordCount(text) >= 8) {
    const hasFormat = /\b(format|json|markdown|yaml|xml|output|respond with|return(?:s)? as|schema)\b/i.test(lower);
    const hasAudience = /\b(audience|reader|for (?:a |an )?(?:developer|beginner|user|kid|exec|engineer)|eli5)\b/i.test(
      lower,
    );
    const hasLength = /\b(\d+\s*(?:words?|sentences?|paragraphs?|lines?|tokens?)|brief|short|long-form|concise|one paragraph)\b/i.test(
      lower,
    );
    const missing: string[] = [];
    if (!hasFormat) missing.push("output format");
    if (!hasAudience) missing.push("audience");
    if (!hasLength) missing.push("length");
    if (missing.length >= 2) {
      out.push({
        kind: "prompt",
        severity: missing.length === 3 ? "high" : "medium",
        title: "blank check",
        detail: `Task prompt is missing ${missing.join(", ")}. The model will invent all of them.`,
        snippet: snippetAt(text, 0),
        line: 1,
        points: 4 * missing.length,
        hits: missing.length,
      });
    }
  }

  if (/\bignore (?:all )?previous instructions\b/i.test(text) && /\bfollow (?:all )?(?:these|the) instructions\b/i.test(text)) {
    const m = /\bignore (?:all )?previous instructions\b/i.exec(text);
    out.push({
      kind: "prompt",
      severity: "medium",
      title: "instruction ouroboros",
      detail: "Told it to ignore instructions and also follow them.",
      snippet: m ? snippetAt(text, m.index) : undefined,
      line: m ? lineAt(text, m.index) : undefined,
      points: 10,
      hits: 1,
    });
  }

  return out;
}

function phraseFindings(text: string): Finding[] {
  const findings: Finding[] = [];
  const seen = new Set<string>();

  for (const pattern of ALL_PHRASE_PATTERNS) {
    const hits = collectHits(text, compile(pattern));
    if (!hits.length) continue;

    // Prefer the more specific phrase when both match the same span.
    if (pattern.id === "as-an-ai") {
      const broader = findings.some((f) => f.title === "the original sin" || f.title === "still introducing itself");
      if (broader) continue;
    }
    if (pattern.id === "potentially") {
      const broader = findings.some((f) => f.title === "double hedge" || f.title === "belt and suspenders");
      if (broader) continue;
    }
    if (pattern.id === "tapestry") {
      const broader = findings.some((f) => f.title === "bonus tapestry");
      if (broader) continue;
    }

    const extra =
      pattern.kind === "overconfidence" &&
      pattern.severity !== "low" &&
      hits.some((h) => !hasGroundingNear(text, h.index))
        ? 4
        : 0;

    const f = findingFromHits(pattern, hits, text, extra);
    const key = `${f.kind}:${f.line}:${f.snippet}`;
    if (seen.has(`${pattern.id}`)) continue;
    seen.add(pattern.id);
    seen.add(key);
    findings.push(f);
  }
  return findings;
}

function totalPoints(findings: Finding[]): number {
  return findings.reduce((sum, f) => sum + f.points, 0);
}

function computeScore(findings: Finding[], words: number): number {
  const pts = totalPoints(findings);
  if (pts <= 0 || words <= 0) return 0;
  const high = findings.filter((f) => f.severity === "high").length;
  const denom = 42 + Math.sqrt(Math.max(words, 8)) * 3.4;
  const density = Math.min(1.25, 0.75 + findings.length / Math.max(6, words / 18));
  const base = (pts / denom) * 100 * density;
  return clampScore(base + high * 3.2);
}

function sortFindings(findings: Finding[]): Finding[] {
  return [...findings]
    .filter((f) => f.points > 0)
    .sort((a, b) => b.points - a.points || (a.line ?? 0) - (b.line ?? 0));
}

export function analyzeText(
  raw: string,
  options: { kind?: TargetKind | "auto"; spicy?: boolean; source?: string } = {},
): TargetResult {
  const text = raw;
  const words = wordCount(text);
  const kind: TargetKind =
    options.kind && options.kind !== "auto" ? options.kind : detectKind(text, options.source);

  const findings = phraseFindings(text);
  capKind(findings, "hedge", HEDGE_POINT_CAP);
  capKind(findings, "fluff", FLUFF_POINT_CAP);
  capKind(findings, "overconfidence", OVERCONF_POINT_CAP);
  findings.push(...hallucinationFindings(text, kind));
  if (kind === "prompt") findings.push(...promptSmellFindings(text));

  const ranked = sortFindings(findings);
  let score = computeScore(ranked, words);
  if (words === 0) score = 0;
  else if (ranked.length === 0) score = Math.min(score, 8);

  return {
    kind,
    source: options.source ?? "input",
    wordCount: words,
    charCount: text.length,
    score,
    label: scoreLabel(score),
    findings: ranked,
    roast: writeRoast(text, kind, ranked, score, Boolean(options.spicy)),
  };
}

export { detectKind, scoreLabel };
