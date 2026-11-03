#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { copyToClipboard } from "./clipboard.js";
import { formatJson, formatPretty } from "./format.js";
import { formatHtml } from "./html.js";
import {
  appendGitHubJobOutput,
  appendGitHubStepSummary,
  formatGitHubAnnotations,
} from "./github.js";
import { HELP } from "./help.js";
import { basename, readSource } from "./io.js";
import { parseArgv, UsageError } from "./parse.js";
import { roastDocumentsAsync, VERSION, type DocumentInput } from "./roast.js";
import { processSuite } from "./suite.js";
import { HTML_THEMES } from "./types.js";

export type CliDeps = {
  copyToClipboard?: (text: string) => boolean;
};

function stdinIsPiped(): boolean {
  return !process.stdin.isTTY;
}

function maybeCopyPretty(
  text: string,
  copy: (text: string) => boolean,
): void {
  // Missing clipboard → skip silently. Helpers must not fail the roast path.
  try {
    copy(text);
  } catch {
    // Clipboard helpers must not fail the roast path.
  }
}

export async function main(argv: string[], deps: CliDeps = {}): Promise<number> {
  let parsed;
  try {
    parsed = parseArgv(argv);
  } catch (err) {
    if (err instanceof UsageError) {
      process.stderr.write(`llm-roast: ${err.message}\n\n${HELP}`);
      return 2;
    }
    throw err;
  }

  if (parsed.cmd === "help") {
    process.stdout.write(HELP);
    return 0;
  }
  if (parsed.cmd === "version") {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }
  if (parsed.cmd === "list-themes") {
    if (parsed.json) {
      process.stdout.write(`${JSON.stringify([...HTML_THEMES])}\n`);
    } else {
      process.stdout.write(`${HTML_THEMES.join("\n")}\n`);
    }
    return 0;
  }

  if (parsed.suite) {
    try {
      const suiteResult = await processSuite(
        parsed.suite,
        parsed.spicy,
        parsed.deepen,
        VERSION,
      );
      
      const output = JSON.stringify(suiteResult, null, 2) + "\n";
      
      if (parsed.out) {
        try {
          await writeFile(parsed.out, output, "utf8");
          if (!parsed.quiet) {
            process.stderr.write(`llm-roast: wrote suite report to ${parsed.out}\n`);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          process.stderr.write(`llm-roast: failed to write ${parsed.out}: ${message}\n`);
          return 2;
        }
      }
      
      process.stdout.write(output);

      // Suite is JSON-only — no pretty roast report to copy. --copy is a silent no-op.
      
      if (parsed.failAbove !== undefined && suiteResult.stats.maxScore > parsed.failAbove) {
        process.stderr.write(
          `llm-roast: suite maxScore ${suiteResult.stats.maxScore} exceeds --fail-above ${parsed.failAbove}\n`,
        );
        return 1;
      }
      return 0;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`llm-roast: ${message}\n`);
      return 2;
    }
  }

  const stdinOnce = { used: false };
  const docs: DocumentInput[] = [];

  try {
    if (parsed.prompt) {
      docs.push({
        text: await readSource(parsed.prompt, stdinOnce),
        kind: "prompt",
        source: basename(parsed.prompt),
      });
    }
    if (parsed.answer) {
      docs.push({
        text: await readSource(parsed.answer, stdinOnce),
        kind: "answer",
        source: basename(parsed.answer),
      });
    }
    if (parsed.positional) {
      docs.push({
        text: await readSource(parsed.positional, stdinOnce),
        kind: "auto",
        source: basename(parsed.positional),
      });
    }
    if (docs.length === 0) {
      if (stdinIsPiped()) {
        docs.push({
          text: await readSource("-", stdinOnce),
          kind: "auto",
          source: "stdin",
        });
      } else {
        process.stderr.write(HELP);
        return 1;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`llm-roast: ${message}\n`);
    return 2;
  }

  const result = await roastDocumentsAsync(docs, parsed.spicy, parsed.deepen);

  const prettyReport = formatPretty(result, {
    color: false,
    spicy: parsed.spicy,
    locale: parsed.locale,
  });

  if (parsed.copy) {
    const copy = deps.copyToClipboard ?? copyToClipboard;
    maybeCopyPretty(prettyReport, copy);
  }

  const htmlOnStdout = parsed.html === true;
  const htmlPath = typeof parsed.html === "string" ? parsed.html : undefined;

  if (parsed.github) {
    const ann = formatGitHubAnnotations(result, {
      maxAnnotations: parsed.maxAnnotations,
    });
    // Keep --json / --html stdout parseable; annotations ride on stderr.
    if (parsed.json || htmlOnStdout) process.stderr.write(ann);
    else process.stdout.write(ann);
    try {
      appendGitHubJobOutput(result);
    } catch (err) {
      process.stderr.write(
        `llm-roast: GITHUB_OUTPUT skipped (${err instanceof Error ? err.message : err})\n`,
      );
    }
    try {
      appendGitHubStepSummary(result);
    } catch (err) {
      process.stderr.write(
        `llm-roast: GITHUB_STEP_SUMMARY skipped (${err instanceof Error ? err.message : err})\n`,
      );
    }
  }

  // Write to file when --out is set
  if (parsed.out) {
    const outputContent = parsed.json ? formatJson(result) : prettyReport;
    
    try {
      await writeFile(parsed.out, outputContent, "utf8");
      if (!parsed.quiet) {
        process.stderr.write(`llm-roast: wrote report to ${parsed.out}\n`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`llm-roast: failed to write ${parsed.out}: ${message}\n`);
      return 2;
    }
  }

  if (htmlPath) {
    const html = formatHtml(result, {
      locale: parsed.locale,
      spicy: parsed.spicy,
      theme: parsed.theme,
    });
    try {
      await mkdir(dirname(htmlPath), { recursive: true });
      await writeFile(htmlPath, html.endsWith("\n") ? html : `${html}\n`, "utf8");
      if (!parsed.quiet) {
        process.stderr.write(`llm-roast: wrote html report to ${htmlPath}\n`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`llm-roast: failed to write ${htmlPath}: ${message}\n`);
      return 2;
    }
  }

  // Write to stdout
  if (parsed.json) {
    process.stdout.write(formatJson(result));
  } else if (htmlOnStdout) {
    const html = formatHtml(result, {
      locale: parsed.locale,
      spicy: parsed.spicy,
      theme: parsed.theme,
    });
    process.stdout.write(html.endsWith("\n") ? html : `${html}\n`);
  } else if (!parsed.out && !htmlPath && !parsed.quiet) {
    if (parsed.github) {
      process.stdout.write("::group::llm-roast report\n");
    }
    process.stdout.write(
      formatPretty(result, {
        color: parsed.github ? false : parsed.color,
        spicy: parsed.spicy,
        locale: parsed.locale,
      }),
    );
    if (parsed.github) {
      process.stdout.write("::endgroup::\n");
    }
  }

  if (parsed.failAbove !== undefined && result.score > parsed.failAbove) {
    process.stderr.write(
      `llm-roast: roast score ${result.score} exceeds --fail-above ${parsed.failAbove}\n`,
    );
    return 1;
  }
  return 0;
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  const self = fileURLToPath(import.meta.url);
  try {
    return (
      realpathSync(entry) === self || realpathSync(entry) === realpathSync(self)
    );
  } catch {
    return /(cli\.(js|ts)|llm-roast)$/.test(entry);
  }
}

if (isDirectRun()) {
  const exitCode = await main(process.argv.slice(2));
  process.exit(exitCode);
}
