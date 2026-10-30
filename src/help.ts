import { VERSION } from "./roast.js";

export const HELP = `🔥 llm-roast  v${VERSION}
Dunk on LLM prompts and answers. Offline heuristics, optional API encore.

Usage:
  llm-roast [options] [file]
  llm-roast --prompt p.txt --answer a.txt
  cat answer.md | llm-roast
  llm-roast - < prompt.txt

Options:
  --prompt <file>           Roast a prompt (use - for stdin)
  --answer <file>           Roast a model answer (use - for stdin)
  --json                    Machine-readable output
  --spicy                   Harsher tone (score unchanged)
  --offline                 Skip optional API deepen even if keys are set
  --fail-above <n>          Exit 1 when Roast Score > n (CI gate; n = 0–100)
  --github                  Emit GitHub Actions annotations (::notice/warning/error)
  --max-annotations <n>     Cap GitHub annotation lines (default: 20)
  --color                   Force ANSI colors
  --no-color                Disable ANSI colors
  -h, --help                Show help
  -v, --version             Show version

Keys (optional):
  OPENAI_API_KEY / ANTHROPIC_API_KEY  one extra roast paragraph

Higher Roast Score = more roastable (0–100).
With --github, annotations go to stdout (or stderr when combined with --json).
Job outputs score/label/findings are written when GITHUB_OUTPUT is set.
A short Markdown job summary is appended when GITHUB_STEP_SUMMARY is set.
`;
