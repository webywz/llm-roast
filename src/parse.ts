export type CliCommand =
  | { cmd: "help" }
  | { cmd: "version" }
  | {
      cmd: "roast";
      positional?: string;
      prompt?: string;
      answer?: string;
      json: boolean;
      spicy: boolean;
      color?: boolean;
      deepen: boolean;
      /** Exit non-zero when Roast Score exceeds this (0–100). */
      failAbove?: number;
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

export function parseArgv(argv: string[]): CliCommand {
  const rest = argv[0] === "--" ? argv.slice(1) : argv.slice();
  let json = false;
  let spicy = false;
  let deepen = true;
  let color: boolean | undefined;
  let prompt: string | undefined;
  let answer: string | undefined;
  let failAbove: number | undefined;
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

  const positional = positionals[0];
  return {
    cmd: "roast",
    positional,
    prompt,
    answer,
    json,
    spicy,
    color,
    deepen,
    failAbove,
  };
}
