import { readFile } from "node:fs/promises";
import { stdin } from "node:process";

export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function readSource(path: string, stdinOnce: { used: boolean }): Promise<string> {
  if (path === "-") {
    if (stdinOnce.used) {
      throw new Error("stdin (-) can only be used once");
    }
    stdinOnce.used = true;
    return readStdin();
  }
  try {
    return await readFile(path, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") throw new Error(`file not found: ${path}`);
    throw err;
  }
}

export function basename(path: string): string {
  if (path === "-") return "stdin";
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}
