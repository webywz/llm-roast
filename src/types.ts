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

export interface FormatOptions {
  color?: boolean;
  spicy?: boolean;
}
