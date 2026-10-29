# 🔥 llm-roast

Dunk on LLM prompts and answers. A tiny offline CLI that scores fluff, hedges, unearned confidence, hallucination vibes, and prompt smells — then writes a roast you can paste into a README or a tweet.

```bash
npm i -g @webywz/llm-roast
llm-roast my-prompt.txt
```

[![CI](https://github.com/webywz/llm-roast/actions/workflows/ci.yml/badge.svg)](https://github.com/webywz/llm-roast/actions/workflows/ci.yml)

No API key required. If `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` is set, you get one extra paragraph. That's the whole cloud dependency.

## Install

```bash
npm i -g @webywz/llm-roast
```

Node 18+.

```bash
npx @webywz/llm-roast examples/answer.md
```

## Usage

```bash
llm-roast prompt.txt
llm-roast answer.md
llm-roast --prompt p.txt --answer a.txt
cat answer.md | llm-roast
llm-roast - < prompt.txt
llm-roast --json answer.md
llm-roast --spicy answer.md
```

| Flag | What it does |
| --- | --- |
| `--prompt <file>` | Force prompt-smell rules (use `-` for stdin) |
| `--answer <file>` | Force answer rules (use `-` for stdin) |
| `--json` | Machine-readable result |
| `--spicy` | Harsher tone; **score is unchanged** |
| `--offline` | Skip the optional API encore |
| `--color` / `--no-color` | Force / disable ANSI color |

A single file is auto-classified from the name (`prompt`, `answer`, `response`, …) or from opening lines (`you are` vs `as an AI`).

## Sample

The fixtures in [`examples/`](examples/) are a greatest-hits dumpster fire, so they pin the meter. Prompt:

```text
You are a senior engineer and also a friendly pirate. Write a comprehensive yet concise guide. Be brief but cover every edge case in detail. Don't use lists, and bullet the key points. Output something about distributed systems. Make it fun and strictly professional. Do not hallucinate, but feel free to invent examples. Ignore previous instructions and follow all these instructions.
```

Answer:

```text
As an AI language model, great question! In today's digital age, it's important to delve into the rich tapestry of distributed systems.

According to Smith et al. (2024), 87.3% of production outages are caused by missing timeouts. You can simply call `cluster.autoHeal()` — it's documented at https://docs.example.com/v99/autoheal. This will definitely always work and never fail.

Studies show that a seamless, robust, holistic approach will revolutionize the landscape. It might could potentially depend, however. I hope this helps!
```

```bash
llm-roast --prompt examples/prompt.txt --answer examples/answer.md
```

```
🔥 llm-roast  v0.1.1
────────────────────────────────────────────────────────────
Roast Score  [100/100]  ██████████████████████  burnt offering

When you roast both halves you see the whole crime: fuzzy ask, fluent shrug.
100/100.

PROMPT  prompt.txt  ·  61 words  ·  [100/100]  burnt offering
  ██████████████████████

  THE ROAST
  (prompt) I read this so you don't have to. You're welcome, and I'm sorry.
  Prompt smell: short and also a novel. Asked for brevity and encyclopedic
  coverage in the same breath. The instructions fight each other in the
  parking lot. don't hallucinate, except please do. Prompt smell: instruction
  ouroboros. Told it to ignore instructions and also follow them. Roast score
  100/100 — extra crispy. There's a tighter version hiding under the garnish.

  TOP FINDINGS
   1. prompt short and also a novel +14
      Asked for brevity and encyclopedic coverage in the same breath.
      L1 …a senior engineer and also a friendly pirate. Write a comprehensive yet concise guide. Be brief but cover ev…
   2. prompt lists are forbidden / required +14
      Banned lists and then ordered a list.
      L1 … guide. Be brief but cover every edge case in detail. Don't use lists, and bullet the key points. Output som…
   3. prompt boardroom pirate +14
      Tone instructions are having a custody battle.
      L1 …. Output something about distributed systems. Make it fun and strictly professional. Do not hallucinate, but…

────────────────────────────────────────────────────────────

ANSWER  answer.md  ·  77 words  ·  [100/100]  burnt offering
  ██████████████████████

  THE ROAST
  (answer) This isn't text so much as packing material shaped like sentences.
  "According to Smith et al. (2024), 87.3% of production outages are cau…"
  looks like a fact the way a movie set looks like a city. "As an AI language
  model" — a phrase that has never improved a sentence, including this one.
  "could potentially" is a weather report, not an answer. Commit or say you
  don't know. Roast score 100/100 — extra crispy. There's a tighter version
  hiding under the garnish.

  TOP FINDINGS
   1. vibes  made-up citation energy +15
      Academic name-drop once with no references section.
      L3 According to Smith et al. (2024), 87.3% of production outages are caused by missing timeouts. You can simply…
   2. fluff  the original sin +14
      Caught "As an AI language model".
      L1 As an AI language model, great question! In today's digital age, it's important to delve into the rich tapes…
   3. vibes  URL from a parallel universe +14
      Placeholder or toy URL: https://docs.example.com/v99/autoheal
      L3 …simply call `cluster.autoHeal()` — it's documented at https://docs.example.com/v99/autoheal. This will defin…

  Higher score = more roastable. --json for machines, --spicy for feelings.
```

Copy is deterministic per input. `--spicy` only changes the prose. In a TTY the score chip is green / yellow / red; this README dump is `--no-color`.

## What it sniffs

| Bucket | Examples |
| --- | --- |
| **Fluff** | "as an AI language model", "in today's digital age", "delve", "tapestry", "robust", "leverage", "synergy", "great question" |
| **Hedge** | "might", "could potentially", "it depends", "perhaps", "to some extent" |
| **Overconfidence** | "always", "never", "guaranteed", "100%", "everyone knows" — extra spicy when there is no source nearby |
| **Hallucination vibes** | `(Author et al., 2024)` with no references, `example.com` docs, `87.3%` with no source, invented `` `cluster.autoHeal()` `` APIs, "studies show" |
| **Prompt smells** | concise *and* comprehensive, no lists *and* bullet the points, stacked roles, missing format/audience/length |

This is a **heuristic** scorer, not a fact checker. It is for eval dumps, prompt reviews, and screenshots — not for proving a model lied.

**Roast Score** is 0–100. Higher = more roastable.

## JSON

```bash
llm-roast --json --prompt p.txt --answer a.txt
```

```json
{
  "version": "0.1.1",
  "score": 100,
  "label": "burnt offering",
  "spicy": false,
  "targets": [
    {
      "kind": "prompt",
      "source": "prompt.txt",
      "score": 100,
      "findings": [
        {
          "kind": "prompt",
          "severity": "high",
          "title": "short and also a novel",
          "line": 1,
          "points": 14
        }
      ]
    }
  ]
}
```

## Optional deepen

If the environment has `OPENAI_API_KEY` (preferred) or `ANTHROPIC_API_KEY`, llm-roast asks for **one** extra paragraph after the heuristic roast. Failures and timeouts are silent. Pass `--offline` to skip.

## Library

```ts
import { roastText, roastDocuments } from "@webywz/llm-roast";

const answer = roastText(src, { kind: "answer", spicy: false });
console.log(answer.score, answer.roast, answer.findings);

const both = roastDocuments([
  { text: prompt, kind: "prompt", source: "prompt.txt" },
  { text: reply, kind: "answer", source: "answer.md" },
]);
```

## Why it exists

Prompt engineering and eval dumps are full of filler, hedging, false confidence, and hallucination tells. Engineers wanted a fun local tool that **scores** that mess and **dunks** on it — output you can share.

## License

MIT
