import type { FormatOptions, Finding, HtmlTheme, RoastResult, TargetResult } from "./types.js";
import { DEFAULT_HTML_THEME } from "./types.js";
import { getStrings } from "./locale.js";

export { DEFAULT_HTML_THEME, HTML_THEMES, isHtmlTheme } from "./types.js";
export type { HtmlTheme } from "./types.js";

/** CSS custom properties for each HTML palette. `ember` matches 0.1.16 exactly. */
export const THEME_TOKENS: Record<HtmlTheme, Record<string, string>> = {
  ember: {
    "--bg": "#1a1b26",
    "--bg-deep": "#16161e",
    "--panel": "#1f2335",
    "--border": "#3b4261",
    "--text": "#c0caf5",
    "--muted": "#565f89",
    "--blue": "#7aa2f7",
    "--cyan": "#7dcfff",
    "--green": "#9ece6a",
    "--orange": "#ff9e64",
    "--red": "#f7768e",
    "--yellow": "#e0af68",
    "--purple": "#bb9af7",
    "--font": 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  },
  fog: {
    "--bg": "#e8eef4",
    "--bg-deep": "#f7f9fc",
    "--panel": "#dce4ee",
    "--border": "#b4c0d0",
    "--text": "#243044",
    "--muted": "#6b7a8d",
    "--blue": "#3d6cb3",
    "--cyan": "#2a8a9a",
    "--green": "#3d8a5a",
    "--orange": "#c46a2d",
    "--red": "#c0455a",
    "--yellow": "#a07a20",
    "--purple": "#6b5a9a",
    "--font": 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
    "--bar-track": "#cfd8e4",
    "--text-soft": "#4a5a6e",
    "--text-dim": "#5a6a7e",
    "--hot-border": "#e0b4bc",
    "--ok-border": "#b4d4be",
    "--mid-border": "#d4c8a0",
    "--kind-border": "#c4bdd8",
  },
  midnight: {
    "--bg": "#0b0d14",
    "--bg-deep": "#07080c",
    "--panel": "#12141c",
    "--border": "#2a3040",
    "--text": "#d4dce8",
    "--muted": "#6a7388",
    "--blue": "#6ea8ff",
    "--cyan": "#5eead4",
    "--green": "#4ade80",
    "--orange": "#fb923c",
    "--red": "#fb7185",
    "--yellow": "#fbbf24",
    "--purple": "#c084fc",
    "--font": 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
    "--bar-track": "#05060a",
    "--text-soft": "#9aa8bc",
    "--text-dim": "#7a889c",
    "--hot-border": "#4a1a24",
    "--ok-border": "#1a3a28",
    "--mid-border": "#3a3020",
    "--kind-border": "#2a2440",
  },
  paper: {
    "--bg": "#f6f0e4",
    "--bg-deep": "#fffaf0",
    "--panel": "#efe6d4",
    "--border": "#d4c4a8",
    "--text": "#3a2f22",
    "--muted": "#8a7a64",
    "--blue": "#3d6a8a",
    "--cyan": "#2d7a7a",
    "--green": "#4a7a40",
    "--orange": "#c46a28",
    "--red": "#b04040",
    "--yellow": "#a07820",
    "--purple": "#7a4a7a",
    "--font": 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
    "--bar-track": "#e0d4c0",
    "--text-soft": "#5a4e3c",
    "--text-dim": "#6a5e4c",
    "--hot-border": "#e0b8b0",
    "--ok-border": "#c0d4b0",
    "--mid-border": "#dcc8a0",
    "--kind-border": "#d4c0d0",
  },
};

function themeRootCss(theme: HtmlTheme): string {
  const tokens = THEME_TOKENS[theme];
  const lines = Object.entries(tokens).map(([key, value]) => `  ${key}: ${value};`);
  return `:root {\n${lines.join("\n")}\n}`;
}

/** Remap leftover 0.1.16 hex literals so non-ember palettes stay readable. */
const THEME_OVERRIDES = `
.spicy { border-color: var(--hot-border); }
.bar { background: var(--bar-track); }
.summary { color: var(--text-soft); }
.chip.tone-ok { border-color: var(--ok-border); }
.chip.tone-mid { border-color: var(--mid-border); }
.chip.tone-hot { border-color: var(--hot-border); }
.roast, .deepen p { color: var(--text); }
.finding .kind { border-color: var(--kind-border); }
.finding p { color: var(--text-soft); }
.snippet { color: var(--text-dim); }
`;

/** Escape text for safe insertion into HTML text/attr contexts. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function scoreTone(score: number): "ok" | "mid" | "hot" {
  if (score <= 28) return "ok";
  if (score <= 68) return "mid";
  return "hot";
}

function kindTag(kind: Finding["kind"]): string {
  switch (kind) {
    case "overconfidence":
      return "ego";
    case "hallucination":
      return "vibes";
    default:
      return kind;
  }
}

function scoreBar(score: number): string {
  const pct = Math.max(0, Math.min(100, score));
  return `<div class="bar" aria-hidden="true"><span class="bar-fill tone-${scoreTone(score)}" style="width:${pct}%"></span></div>`;
}

function findingsHtml(
  findings: Finding[],
  noFindingsText: string,
): string {
  if (!findings.length) {
    return `<p class="empty">${escapeHtml(noFindingsText)}</p>`;
  }
  const rows = findings
    .map((f, i) => {
      const loc = f.line ? `L${f.line}` : "";
      const snippet = f.snippet
        ? `<div class="snippet">${loc ? `<span class="loc">${escapeHtml(loc)}</span> ` : ""}<code>${escapeHtml(f.snippet)}</code></div>`
        : "";
      return `<article class="finding severity-${escapeHtml(f.severity)}">
  <header>
    <span class="idx">${i + 1}</span>
    <span class="kind">${escapeHtml(kindTag(f.kind))}</span>
    <span class="sev">${escapeHtml(f.severity)}</span>
    <strong>${escapeHtml(f.title)}</strong>
    <span class="pts">+${f.points}</span>
  </header>
  <p>${escapeHtml(f.detail)}</p>
  ${snippet}
</article>`;
    })
    .join("\n");
  return `<div class="findings">${rows}</div>`;
}

function targetHtml(
  t: TargetResult,
  strings: ReturnType<typeof getStrings>,
): string {
  return `<section class="target">
  <header class="target-head">
    <span class="kind-label">${escapeHtml(t.kind.toUpperCase())}</span>
    <span class="source">${escapeHtml(t.source)}</span>
    <span class="meta">${t.wordCount} ${escapeHtml(strings.words)}</span>
    <span class="chip tone-${scoreTone(t.score)}">${t.score}/100</span>
    <span class="label">${escapeHtml(t.label)}</span>
  </header>
  ${scoreBar(t.score)}
  <h2>${escapeHtml(strings.theRoast)}</h2>
  <p class="roast">${escapeHtml(t.roast)}</p>
  <h2>${escapeHtml(strings.topFindings)}</h2>
  ${findingsHtml(t.findings, strings.noFindings)}
</section>`;
}

/**
 * Self-contained roast HTML report (inline CSS, no CDN, no external fonts/scripts).
 * Safe for untrusted roast text: all user/content fields are HTML-escaped.
 */
export function formatHtml(result: RoastResult, options: FormatOptions = {}): string {
  const locale = options.locale || "en";
  const theme = options.theme || DEFAULT_HTML_THEME;
  const strings = getStrings(locale);
  const tone = scoreTone(result.score);
  const spicy = result.spicy
    ? `<span class="spicy">${escapeHtml(strings.spicy)}</span>`
    : "";
  const summary = result.summary
    ? `<p class="summary">${escapeHtml(result.summary)}</p>`
    : "";
  const deepen = result.deepen
    ? `<section class="deepen"><h2>${escapeHtml(strings.deepen)}</h2><p>${escapeHtml(result.deepen)}</p></section>`
    : "";
  const targets = result.targets.map((t) => targetHtml(t, strings)).join("\n");
  const sources = result.targets.map((t) => t.source).filter(Boolean).join(" · ") || "stdin";
  const title = `llm-roast · ${result.score}/100 · ${result.label}`;
  const themeOverrides = theme === "ember" ? "" : THEME_OVERRIDES;

  return `<!DOCTYPE html>
<html lang="${escapeHtml(locale)}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>
${themeRootCss(theme)}
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0;
  background: var(--bg); color: var(--text);
  font: 14px/1.5 var(--font);
}
body { padding: 28px 20px 56px; max-width: 880px; margin: 0 auto; }
.top {
  border: 1px solid var(--border); background: var(--panel);
  padding: 18px 20px; margin-bottom: 16px;
}
.top h1 { margin: 0 0 8px; font-size: 15px; font-weight: 600; letter-spacing: 0.03em; }
.top .meta { color: var(--muted); font-size: 12px; }
.spicy {
  display: inline-block; margin-left: 8px; padding: 1px 8px;
  border: 1px solid #5a1d1d; color: var(--red); font-size: 11px;
  text-transform: uppercase; letter-spacing: 0.08em;
}
.hero {
  border: 1px solid var(--border); background: var(--bg-deep);
  padding: 22px 20px; margin-bottom: 16px;
}
.hero .kicker {
  color: var(--muted); font-size: 11px; text-transform: uppercase;
  letter-spacing: 0.1em; margin: 0 0 8px;
}
.hero .score {
  font-size: 42px; font-weight: 700; letter-spacing: -0.03em; line-height: 1;
}
.hero .score.tone-ok { color: var(--green); }
.hero .score.tone-mid { color: var(--yellow); }
.hero .score.tone-hot { color: var(--red); }
.hero .label { color: var(--muted); margin-top: 8px; }
.bar {
  margin-top: 14px; height: 8px; background: #11131c;
  border: 1px solid var(--border); overflow: hidden;
}
.bar-fill { display: block; height: 100%; }
.bar-fill.tone-ok { background: var(--green); }
.bar-fill.tone-mid { background: var(--yellow); }
.bar-fill.tone-hot { background: var(--red); }
.summary { margin: 14px 0 0; color: #a9b1d6; }
.target {
  border: 1px solid var(--border); background: var(--panel);
  padding: 16px 18px; margin: 0 0 14px;
}
.target-head {
  display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: baseline;
}
.kind-label { color: var(--cyan); font-weight: 600; letter-spacing: 0.04em; }
.source { color: var(--text); }
.meta, .label { color: var(--muted); }
.chip {
  padding: 1px 8px; border: 1px solid var(--border); font-size: 12px;
}
.chip.tone-ok { color: var(--green); border-color: #3d4f2f; }
.chip.tone-mid { color: var(--yellow); border-color: #5a4a24; }
.chip.tone-hot { color: var(--red); border-color: #5a1d1d; }
h2 {
  font-size: 11px; color: var(--muted); text-transform: uppercase;
  letter-spacing: 0.1em; margin: 16px 0 8px; font-weight: 600;
}
.roast, .deepen p { margin: 0; color: #c0caf5; white-space: pre-wrap; }
.findings { display: flex; flex-direction: column; gap: 8px; }
.finding {
  border: 1px solid var(--border); background: var(--bg-deep); padding: 10px 12px;
}
.finding header { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; }
.finding .idx { color: var(--muted); min-width: 1.5ch; }
.finding .kind {
  color: var(--purple); border: 1px solid #3b3358; padding: 0 6px; font-size: 11px;
}
.finding .sev { color: var(--orange); font-size: 11px; text-transform: uppercase; }
.finding .pts { margin-left: auto; color: var(--muted); }
.finding p { margin: 8px 0 0; color: #a9b1d6; }
.snippet { margin-top: 8px; color: #9aa5ce; }
.snippet .loc { color: var(--cyan); }
.snippet code { font: inherit; color: var(--text); }
.empty { color: var(--muted); }
.deepen {
  border: 1px solid var(--border); background: var(--panel);
  padding: 16px 18px; margin: 0 0 14px;
}
footer {
  margin-top: 24px; color: var(--muted); font-size: 11px;
  border-top: 1px solid var(--border); padding-top: 12px;
}
@media (max-width: 640px) {
  .hero .score { font-size: 32px; }
}
${themeOverrides}</style>
</head>
<body>
<header class="top">
  <h1>🔥 llm-roast ${spicy}</h1>
  <div class="meta">${escapeHtml(strings.version)}${escapeHtml(result.version)} · ${escapeHtml(sources)}</div>
</header>
<section class="hero">
  <p class="kicker">${escapeHtml(strings.roastScore)}</p>
  <div class="score tone-${tone}">${result.score}/100</div>
  <div class="label">${escapeHtml(result.label)}</div>
  ${scoreBar(result.score)}
  ${summary}
</section>
${targets}
${deepen}
<footer>${escapeHtml(strings.footer)} · self-contained · offline (file://)</footer>
</body>
</html>
`;
}
