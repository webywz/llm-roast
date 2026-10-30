# llm-roast

<p align="center">
  <a href="https://github.com/webywz/llm-roast/actions/workflows/ci.yml"><img src="https://github.com/webywz/llm-roast/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/@webywz/llm-roast"><img src="https://img.shields.io/npm/v/@webywz/llm-roast.svg" alt="npm" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT" /></a>
</p>

<p align="center">
  <strong>Roast LLM prompts and answers — fluff, hedges, hallucination vibes, scored 0–100.</strong><br/>
  Offline heuristics first. Optional API encore only if you already have a key.
</p>

<p align="center">
  吐槽 LLM 的 prompt 与回答：注水、含糊、幻觉气味，打分 0–100。<br/>
  本地启发式优先；只有你自己有 Key 时才可选多一段 API 评语。
</p>

A tiny CLI for eval dumps, prompt reviews, and screenshots you can share. Higher **Roast Score** means more roastable. This is a heuristic scorer, not a fact checker.

给评测 dump、prompt 复盘和可分享截图用的小 CLI。**Roast Score** 越高越该被吐槽。这是启发式打分，不是事实核查器。

---

## Install · 安装

```bash
npm i -g @webywz/llm-roast
npx @webywz/llm-roast examples/answer.md
```

Requires **Node.js 18.18+**. Package: [`@webywz/llm-roast`](https://www.npmjs.com/package/@webywz/llm-roast). Binary: `llm-roast`.

需要 **Node.js 18.18+**。包名 `@webywz/llm-roast`，命令仍是 `llm-roast`。

---

## Quick start · 快速开始

```bash
llm-roast prompt.txt
llm-roast answer.md
llm-roast --prompt p.txt --answer a.txt
cat answer.md | llm-roast
llm-roast - < prompt.txt
llm-roast --json answer.md
llm-roast --spicy answer.md
llm-roast --offline --fail-above 60 answer.md
llm-roast --github --offline answer.md
llm-roast --github --quiet --offline answer.md
llm-roast --github --max-annotations 10 --offline answer.md
```

| Flag | What it does · 作用 |
| --- | --- |
| `--prompt <file>` | Force prompt-smell rules (`-` = stdin) · 按 prompt 气味规则打分 |
| `--answer <file>` | Force answer rules (`-` = stdin) · 按回答规则打分 |
| `--json` | Machine-readable result · 机器可读输出 |
| `--spicy` | Harsher tone; **score unchanged** · 文案更狠；**分数不变** |
| `--offline` | Skip the optional API encore · 跳过可选 API 加戏 |
| `--fail-above <n>` | Exit `1` when Roast Score **>** `n` (0–100) · 分数 **大于** `n` 时退出码 `1` |
| `--github` | Emit GitHub Actions `::notice` / `::warning` / `::error` annotations · 输出 Actions 注解，PR Checks 可见 |
| `--max-annotations <n>` | Cap annotation lines with `--github` (default `20`) · 限制 `--github` 注解条数（默认 20） |
| `--quiet` | Suppress the pretty terminal report; `--json` / `--github` still emit · 抑制漂亮终端报告；`--json` / `--github` 仍照常输出 |
| `--color` / `--no-color` | Force / disable ANSI color · 强制 / 关闭颜色 |
| `-h` / `-v` | Help / version · 帮助 / 版本 |

A bare file is auto-classified from the name (`prompt`, `answer`, `response`, …) or opening lines (`you are` vs `as an AI`).

单文件会按文件名或开头几行自动判断是 prompt 还是 answer。

Fixtures: [`examples/prompt.txt`](examples/prompt.txt) · [`examples/answer.md`](examples/answer.md).

示例：`examples/prompt.txt` 与 `examples/answer.md`。

```yaml
# GitHub Actions — annotations + CI gate + job summary
- name: Roast gate
  run: npx @webywz/llm-roast --offline --github --quiet --fail-above 60 --max-annotations 20 path/to/answer.md
```

Copy-paste workflow: [`examples/github-actions.yml`](examples/github-actions.yml).

可直接复制的 workflow：[`examples/github-actions.yml`](examples/github-actions.yml)。

`--github` prints workflow commands (`::warning file=…::…`) so Checks show score and findings. High severity → `error`, medium → `warning`, low → `notice`; score bands use the same scale. With `GITHUB_OUTPUT` set it also writes `score`, `label`, `findings`. With `GITHUB_STEP_SUMMARY` set it appends a short Markdown job summary (score / label / key findings). Use `--max-annotations <n>` to soft-cap PR noise (default 20). `--quiet` suppresses the pretty terminal report only (`--json` / `--github` annotations, summary, and outputs still emit). Combine with `--json` and annotations go to stderr so stdout stays parseable. Works together with `--fail-above` (annotations still emit, then exit `1` when over the gate).

`--github` 输出 workflow 命令，PR Checks 能直接看到分数与 findings。高严重 → `error`，中 → `warning`，低 → `notice`；总分按档位映射。在 Actions 里还会写 `GITHUB_OUTPUT`（`score` / `label` / `findings`），有 `GITHUB_STEP_SUMMARY` 时再追加一段简洁 Job Summary。`--max-annotations <n>` 可限制注解条数（默认 20）。`--quiet` 只抑制漂亮终端报告（`--json` / `--github` 注解、summary、outputs 仍照常）。与 `--json` 联用时注解走 stderr，stdout 仍是干净 JSON。可与 `--fail-above` 组合：先出注解，超阈再以 `1` 退出。

`--fail-above 100` never fails (score tops at 100). `--fail-above 0` fails on any non-zero score.

`--fail-above 100` 永远不会失败（满分 100）；`--fail-above 0` 只要非零就失败。

### Library · 库

```ts
import { roastText, roastDocuments } from "@webywz/llm-roast";

const answer = roastText(src, { kind: "answer", spicy: false });
console.log(answer.score, answer.roast, answer.findings);

const both = roastDocuments([
  { text: prompt, kind: "prompt", source: "prompt.txt" },
  { text: reply, kind: "answer", source: "answer.md" },
]);
```

---

## Features · 特性

| Bucket · 桶 | Examples · 例子 |
| --- | --- |
| **Fluff** | "as an AI language model", "in today's digital age", "delve", "tapestry", "robust", "leverage", "synergy", "great question" |
| **Hedge** | "might", "could potentially", "it depends", "perhaps", "to some extent" |
| **Overconfidence** | "always", "never", "guaranteed", "100%", "everyone knows" — extra weight when no nearby source · 附近没有出处时更重 |
| **Hallucination vibes** | `(Author et al., 2024)` with no references, `example.com` docs, precise `%` with no source, invented APIs, "studies show" |
| **Prompt smells** | concise *and* comprehensive, no lists *and* bullet the points, stacked roles, missing format / audience / length |

- **Deterministic copy** — same input → same roast text. `--spicy` only changes tone.
  **文案确定** — 相同输入得到相同吐槽；`--spicy` 只改语气。
- **CI gate** — `--fail-above` still prints the roast, then exits `1` only when the score exceeds the threshold.
  **CI 门禁** — 仍会打印吐槽；仅当分数超过阈值时以 `1` 退出。
- **GitHub annotations** — `--github` emits Actions notices/warnings/errors for PR UI; optional Job Summary + `--max-annotations`; `--quiet` for annotations-only CI logs.
  **GitHub 注解** — `--github` 输出 Actions notice/warning/error；可选 Job Summary 与 `--max-annotations`；`--quiet` 只留注解不打漂亮报告。
- **Optional deepen** — with `OPENAI_API_KEY` (preferred) or `ANTHROPIC_API_KEY`, one extra paragraph after the heuristic roast. Failures and timeouts stay quiet. `--offline` skips it.
  **可选加深** — 有 OpenAI（优先）或 Anthropic Key 时，启发式之后多一段评语；失败 / 超时静默。`--offline` 跳过。

---

## Links · 链接

- npm · [`@webywz/llm-roast`](https://www.npmjs.com/package/@webywz/llm-roast)
- Source · [github.com/webywz/llm-roast](https://github.com/webywz/llm-roast)
- Related · [prompt-diff](https://github.com/webywz/prompt-diff) · [eval-smoke](https://github.com/webywz/eval-smoke)
- License · [MIT](./LICENSE)

```bash
npm install && npm test && npm run typecheck
```
