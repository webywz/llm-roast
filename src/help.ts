import { VERSION } from "./roast.js";

export const HELP = `🔥 llm-roast  v${VERSION}
Dunk on LLM prompts and answers. Offline heuristics, optional API encore.

Usage:
  llm-roast [options] [file]
  llm-roast --prompt p.txt --answer a.txt
  llm-roast --suite <glob|dir>
  cat answer.md | llm-roast
  llm-roast - < prompt.txt

Options:
  --prompt <file>           Roast a prompt (use - for stdin)
  --answer <file>           Roast a model answer (use - for stdin)
  --suite <glob|dir>        Batch mode: glob/brace pattern or directory (≥2 files, JSON out)
                            Supports brace expansion: {a,b}, e.g. "dir/{good,bad}/*.md"
  --out <file>              Write report to file
  --json                    Machine-readable output
  --spicy                   Harsher tone (score unchanged)
  --offline                 Skip optional API deepen even if keys are set
  --locale <en|zh>          Terminal output locale (default: en; JSON keys unchanged)
  --fail-above <n>          Exit 1 when Roast Score > n (suite: maxScore > n; n = 0–100)
  --github                  Emit GitHub Actions annotations (::notice/warning/error)
  --max-annotations <n>     Cap GitHub annotation lines (default: 20)
  --quiet                   Suppress the pretty terminal report (--json / --github still emit)
  --color                   Force ANSI colors
  --no-color                Disable ANSI colors
  -h, --help                Show help
  -v, --version             Show version

Keys (optional):
  OPENAI_API_KEY / ANTHROPIC_API_KEY  one extra roast paragraph

Exit codes:
  0  Success
  1  Roast score exceeds --fail-above
  2  Usage error or I/O failure

Higher Roast Score = more roastable (0–100).
Suite mode (--suite) roasts ≥2 files and emits JSON with per-file scores
plus aggregated stats (count, maxScore, avgScore, failCount).
Supports brace expansion: fixtures/{good,bad}/*.md or dir/{a,b}.md
With --github, annotations go to stdout (or stderr when combined with --json).
Job outputs score/label/findings are written when GITHUB_OUTPUT is set.
A short Markdown job summary is appended when GITHUB_STEP_SUMMARY is set.
--quiet hides the pretty report only.
`;
