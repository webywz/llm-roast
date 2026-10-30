export type Locale = "en" | "zh";

interface LocaleStrings {
  roastScore: string;
  theRoast: string;
  topFindings: string;
  noFindings: string;
  moreFindings: (n: number) => string;
  words: string;
  deepen: string;
  footer: string;
  spicy: string;
  version: string;
}

const EN: LocaleStrings = {
  roastScore: "Roast Score",
  theRoast: "THE ROAST",
  topFindings: "TOP FINDINGS",
  noFindings: "(no findings — suspiciously clean)",
  moreFindings: (n: number) => `… ${n} more finding(s)`,
  words: "words",
  deepen: "DEEPEN",
  footer: "Higher score = more roastable. --json for machines, --spicy for feelings.",
  spicy: "spicy",
  version: "v",
};

const ZH: LocaleStrings = {
  roastScore: "吐槽分",
  theRoast: "吐槽内容",
  topFindings: "主要问题",
  noFindings: "（没发现问题 — 干净得可疑）",
  moreFindings: (n: number) => `… 还有 ${n} 条`,
  words: "词",
  deepen: "深度分析",
  footer: "分数越高越该被吐槽。--json 给机器，--spicy 给感情。",
  spicy: "辛辣",
  version: "v",
};

const LOCALES: Record<Locale, LocaleStrings> = {
  en: EN,
  zh: ZH,
};

export function getStrings(locale: Locale): LocaleStrings {
  return LOCALES[locale];
}

export function parseLocale(raw: string | undefined): Locale | undefined {
  if (!raw) return undefined;
  if (raw === "en" || raw === "zh") return raw;
  throw new Error(`--locale must be "en" or "zh", got: ${raw}`);
}
