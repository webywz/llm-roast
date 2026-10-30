#!/usr/bin/env node
import { formatJson, formatPretty } from "./format.js";
import { HELP } from "./help.js";
import { basename, readSource } from "./io.js";
import { parseArgv, UsageError } from "./parse.js";
import { roastDocumentsAsync, VERSION } from "./roast.js";
import type { DocumentInput } from "./roast.js";

function stdinIsPiped(): boolean {
  return !process.stdin.isTTY;
}

async function main(argv: string[]): Promise<number> {
  let parsed;
  try {
    parsed = parseArgv(argv);
  } catch (err) {
    if (err instanceof UsageError) {
      process.stderr.write(`llm-roast: ${err.message}\n\n${HELP}`);
      return 1;
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
    return 1;
  }

  const result = await roastDocumentsAsync(docs, parsed.spicy, parsed.deepen);
  if (parsed.json) {
    process.stdout.write(formatJson(result));
  } else {
    process.stdout.write(formatPretty(result, { color: parsed.color, spicy: parsed.spicy }));
  }

  if (parsed.failAbove !== undefined && result.score > parsed.failAbove) {
    process.stderr.write(
      `llm-roast: roast score ${result.score} exceeds --fail-above ${parsed.failAbove}\n`,
    );
    return 1;
  }
  return 0;
}

const exitCode = await main(process.argv.slice(2));
process.exit(exitCode);
