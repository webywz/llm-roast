import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Compile once before workers start so parallel CLI tests do not race on dist/. */
export default function setup(): void {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const tsc = join(root, "node_modules/typescript/bin/tsc");
  execFileSync(process.execPath, [tsc, "-p", "tsconfig.json"], { cwd: root });
}
