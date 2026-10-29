import { hash32, pick } from "./text.js";
import type { Finding, FindingKind, TargetKind } from "./types.js";

const OPENERS_DEFAULT = [
  "I read this so you don't have to. You're welcome, and I'm sorry.",
  "The vibes are giving autocomplete with a LinkedIn subscription.",
  "Somewhere a writing tutor just felt a disturbance in the force.",
  "This isn't text so much as packing material shaped like sentences.",
];

const OPENERS_SPICY = [
  "This is what happens when a thesaurus and a liability waiver have a child.",
  "I would call this purple prose but that insults actual purple.",
  "If confidence were a crime this would be a three-strikes case.",
  "This isn't a draft. It's a hostage note from the average token.",
];

const CLOSERS_DEFAULT = [
  "Fix: delete the throat-clearing, ground the numbers, pick a tone, and try again.",
  "The roast score is a suggestion. The findings are a to-do list.",
  "Ship the version that would survive a staff-engineer skim.",
];

const CLOSERS_SPICY = [
  "Burn the filler. Cite the claims. Stop stacking roles like Pokémon.",
  "Rewrite it like someone might screenshot this. Oh wait.",
  "Less tapestry. More truth. That's the whole review.",
];

const KIND_LINES: Record<FindingKind, { def: string[]; spicy: string[] }> = {
  fluff: {
    def: [
      `{n} fluff hit(s), including {title}. "{quote}" is doing the work of a stock photo.`,
      `The filler is doing cardio: {title} showed up {n} time(s). We get it. It's important to note nothing.`,
      `"{quote}" — a phrase that has never improved a sentence, including this one.`,
    ],
    spicy: [
      `"{quote}" should be tried at The Hague of bland writing. {n} hit(s).`,
      `{title}: this is the literary equivalent of a handshake in a bank commercial.`,
    ],
  },
  hedge: {
    def: [
      `Hedging like it's paid by the syllable. {title} landed {n} time(s). Take a position.`,
      `"{quote}" is a weather report, not an answer. Commit or say you don't know.`,
    ],
    spicy: [
      `This hedges so hard it could get a job in communications. {n} weasel pass(es).`,
      `"{quote}" is how text avoids being useful. Embarrassing, in a corporate way.`,
    ],
  },
  overconfidence: {
    def: [
      `Unlicensed certainty: {title}. If it's that settled, a source would have been cheaper than the swagger.`,
      `"{quote}" with no receipts. That's not confidence, that's cosplay.`,
    ],
    spicy: [
      `"{quote}" — said with the energy of a keynote and the evidence of a shrug.`,
      `Absolute claims, relative homework. {title} is doing numbers it didn't earn.`,
    ],
  },
  hallucination: {
    def: [
      `Hallucination vibes: {title}. {detail} That's how eval dumps become folklore.`,
      `"{quote}" looks like a fact the way a movie set looks like a city.`,
    ],
    spicy: [
      `{title}. If this number/API/URL existed, it would like to speak with its lawyer.`,
      `Made-up citations are not a personality. {detail}`,
    ],
  },
  prompt: {
    def: [
      `Prompt smell: {title}. {detail}`,
      `The instructions fight each other in the parking lot. {title}.`,
    ],
    spicy: [
      `{title}. This prompt is a group project where nobody read the brief.`,
      `{detail} That's not prompt engineering, that's leaving a voicemail for a genie.`,
    ],
  },
};

function quoteOf(finding: Finding): string {
  if (!finding.snippet) return finding.title;
  const m = finding.detail.match(/"([^"]+)"/);
  if (m?.[1]) return m[1];
  const clipped = finding.snippet.length > 72 ? `${finding.snippet.slice(0, 69)}…` : finding.snippet;
  return clipped;
}

function fill(template: string, finding: Finding): string {
  return template
    .replaceAll("{title}", finding.title)
    .replaceAll("{n}", String(finding.hits))
    .replaceAll("{quote}", quoteOf(finding))
    .replaceAll("{detail}", finding.detail);
}

function uniqueTop(findings: Finding[], n: number): Finding[] {
  const out: Finding[] = [];
  const kinds = new Set<FindingKind>();
  for (const f of findings) {
    if (out.length >= n) break;
    if (kinds.has(f.kind) && out.length + (findings.length - findings.indexOf(f)) > n) {
      if (out.some((x) => x.kind === f.kind)) continue;
    }
    if (out.some((x) => x.title === f.title)) continue;
    kinds.add(f.kind);
    out.push(f);
  }
  if (out.length < Math.min(n, findings.length)) {
    for (const f of findings) {
      if (out.length >= n) break;
      if (!out.includes(f)) out.push(f);
    }
  }
  return out;
}

export function writeRoast(
  text: string,
  kind: TargetKind,
  findings: Finding[],
  score: number,
  spicy: boolean,
): string {
  const seed = hash32(text);
  if (text.trim().length === 0) {
    return spicy
      ? "You handed me the empty string. I can't roast a vacuum, but I respect the bit."
      : "Nothing to roast — the void stares back, politely.";
  }
  if (findings.length === 0) {
    return spicy
      ? `A ${kind} that doesn't trip the alarms. Either you're good or the sample is too short to embarrass you. Score ${score}. Annoying.`
      : `This ${kind} is annoyingly hard to roast. Score ${score}/100. Keep writing like a human.`;
  }

  const opener = pick(spicy ? OPENERS_SPICY : OPENERS_DEFAULT, seed, 1);
  const top = uniqueTop(findings, 3);
  const body = top.map((f, i) => {
    const bank = KIND_LINES[f.kind];
    const line = pick(spicy ? bank.spicy : bank.def, seed, i + 3);
    return fill(line, f);
  });
  const closer =
    score >= 80
      ? spicy
        ? `Score ${score}/100. Extra crispy. Screenshot this and do better.`
        : `Roast score ${score}/100 — extra crispy. There's a tighter version hiding under the garnish.`
      : pick(spicy ? CLOSERS_SPICY : CLOSERS_DEFAULT, seed, 9);

  const who = kind === "prompt" ? "prompt" : "answer";
  return [`(${who}) ${opener}`, ...body, closer].join(" ");
}

export function writeCombinedRoast(
  promptWords: number,
  answerWords: number,
  spicy: boolean,
  score: number,
): string {
  const seed = hash32(`${promptWords}:${answerWords}:${score}:${spicy ? 1 : 0}`);
  if (spicy) {
    return pick(
      [
        `Two-for-one: a ${promptWords}-word brief feeding a ${answerWords}-word answer that believed every contradiction. Combined score ${score}.`,
        `The prompt asked for everything; the answer delivered nothing with confidence. Combined roast ${score}/100.`,
        `Prompt and answer are in a toxic relationship and you're the couples counselor. ${score}/100.`,
      ],
      seed,
      2,
    );
  }
  return pick(
    [
      `Roasted both sides. The prompt set the tripwires; the answer jogged through them. Combined score ${score}/100.`,
      `Prompt + answer: a matching set. One vague, one fluffy. Combined roast ${score}/100.`,
      `When you roast both halves you see the whole crime: fuzzy ask, fluent shrug. ${score}/100.`,
    ],
    seed,
    2,
  );
}
