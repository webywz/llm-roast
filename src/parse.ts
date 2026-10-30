export type CliCommand =
  | { cmd: "help" }
  | { cmd: "version" }
  | {
      cmd: "roast";
      positional?: string;
      prompt?: string;
      answer?: string;
      suite?: string;
      json: boolean;
      spicy: boolean;
      color?: boolean;
      deepen: boolean;
      /** Exit non-zero when Roast Score exceeds this (0–100). */
      failAbove?: number;
      /** Emit GitHub Actions workflow annotations. */
      github: boolean;
      /** Soft cap for GitHub annotation lines (default 20). */
      maxAnnotations: number;
      /** Suppress the pretty terminal report (--json / --github still emit). */
      quiet: boolean;
    };

export class UsageError extends Error {
  override readonly name = "UsageError";
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function parseFailAbove(raw: string | undefined): number {
  if (raw === undefined || raw === "") {
    throw new UsageError("--fail-above requires an integer from 0 to 100");
  }
  if (!/^\d+$/.test(raw)) {
    throw new UsageError("--fail-above requires an integer from 0 to 100");
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 100) {
    throw new UsageError("--fail-above requires an integer from 0 to 100");
  }
  return n;
}

function parseMaxAnnotations(raw: string | undefined): number {
  if (raw === undefined || raw === "") {
    throw new UsageError("--max-annotations must be a positive integer");
  }
  if (!/^\d+$/.test(raw)) {
    throw new UsageError("--max-annotations must be a positive integer");
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new UsageError("--max-annotations must be a positive integer");
  }
  return n;
}

export function parseArgv(argv: string[]): CliCommand {
  const rest = argv[0] === "--" ? argv.slice(1) : argv.slice();
  let json = false;
  let spicy = false;
  let deepen = true;
  let color: boolean | undefined;
  let prompt: string | undefined;
  let answer: string | undefined;
  let suite: string | undefined;
  let failAbove: number | undefined;
  let github = false;
  let maxAnnotations = 20;
  let quiet = false;
  const positionals: string[] = [];

  const takeValue = (i: number, flag: string, next?: string): [string, number] => {
    if (!next || (next.startsWith("-") && next !== "-")) {
      throw new UsageError(`${flag} requires a file path (or - for stdin)`);
    }
    return [next, i + 1];
  };

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]!;
    switch (arg) {
      case "-h":
      case "--help":
        return { cmd: "help" };
      case "-v":
      case "--version":
        return { cmd: "version" };
      case "--json":
        json = true;
        break;
      case "--spicy":
        spicy = true;
        break;
      case "--offline":
        deepen = false;
        break;
      case "--no-color":
        color = false;
        break;
      case "--color":
        color = true;
        break;
      case "--fail-above": {
        failAbove = parseFailAbove(rest[i + 1]);
        i += 1;
        break;
      }
      case "--max-annotations": {
        maxAnnotations = parseMaxAnnotations(rest[i + 1]);
        i += 1;
        break;
      }
      case "--github":
        github = true;
        break;
      case "--quiet":
        quiet = true;
        break;
      case "--prompt": {
        const [val, ni] = takeValue(i, "--prompt", rest[i + 1]);
        prompt = val;
        i = ni;
        break;
      }
      case "--answer": {
        const [val, ni] = takeValue(i, "--answer", rest[i + 1]);
        answer = val;
        i = ni;
        break;
      }
      case "--suite": {
        const [val, ni] = takeValue(i, "--suite", rest[i + 1]);
        suite = val;
        i = ni;
        break;
      }
      default:
        if (arg.startsWith("-") && arg !== "-") {
          throw new UsageError(`unknown option: ${arg}`);
        }
        positionals.push(arg);
    }
  }

  if (positionals.length > 1) {
    throw new UsageError("expected at most one file argument (or use --prompt / --answer)");
  }
  if (positionals.length === 1 && (prompt || answer)) {
    throw new UsageError("pass either a file argument or --prompt/--answer, not both");
  }
  if (suite && (positionals.length > 0 || prompt || answer)) {
    throw new UsageError("--suite cannot be combined with file arguments or --prompt/--answer");
  }

  const positional = positionals[0];
  return {
    cmd: "roast",
    positional,
    prompt,
    answer,
    suite,
    json,
    spicy,
    color,
    deepen,
    failAbove,
    github,
    maxAnnotations,
    quiet,
  };
}
