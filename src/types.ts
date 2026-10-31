export type TargetKind = "prompt" | "answer";

export type FindingKind =
  | "fluff"
  | "hedge"
  | "overconfidence"
  | "hallucination"
  | "prompt";

export type Severity = "low" | "medium" | "high";

export interface Finding {
  kind: FindingKind;
  severity: Severity;
  title: string;
  detail: string;
  snippet?: string;
  line?: number;
  points: number;
  hits: number;
}

export interface RoastOptions {
  kind?: TargetKind | "auto";
  spicy?: boolean;
  source?: string;
}

export interface TargetResult {
  kind: TargetKind;
  source: string;
  wordCount: number;
  charCount: number;
  score: number;
  label: string;
  findings: Finding[];
  roast: string;
}

export interface RoastResult {
  version: string;
  score: number;
  label: string;
  spicy: boolean;
  targets: TargetResult[];
  /** Extra line when roasting prompt + answer together. */
  summary?: string;
  deepen?: string;
}

/** Offline HTML report palettes (`--theme`). `ember` is the 0.1.16 default look. */
export const HTML_THEMES = ["ember", "fog", "midnight", "paper"] as const;
export type HtmlTheme = (typeof HTML_THEMES)[number];
export const DEFAULT_HTML_THEME: HtmlTheme = "ember";

export function isHtmlTheme(name: string): name is HtmlTheme {
  return (HTML_THEMES as readonly string[]).includes(name);
}

export interface FormatOptions {
  color?: boolean;
  spicy?: boolean;
  locale?: "en" | "zh";
  /** HTML report palette only; ignored by pretty / JSON formatters. */
  theme?: HtmlTheme;
}
