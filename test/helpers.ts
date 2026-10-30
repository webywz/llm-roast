import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const cli = join(root, "dist/cli.js");
export const answer = join(root, "examples/answer.md");
export const prompt = join(root, "examples/prompt.txt");
export const examples = join(root, "examples");

/**
 * Run the compiled CLI. Strips inherited Actions output files so `--github`
 * tests do not append to the real job `GITHUB_OUTPUT` / `GITHUB_STEP_SUMMARY`
 * unless the caller opts in.
 */
export function runCli(
  args: string[],
  env: Record<string, string | undefined> = {},
): SpawnSyncReturns<string> {
  const { GITHUB_OUTPUT: _go, GITHUB_STEP_SUMMARY: _gs, ...inherited } = process.env;
  const next: NodeJS.ProcessEnv = { ...inherited, NO_COLOR: "1" };
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete next[key];
    else next[key] = value;
  }
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    env: next,
  });
}
