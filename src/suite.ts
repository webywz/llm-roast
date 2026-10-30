import { readdir, stat } from "node:fs/promises";
import { basename, readSource } from "./io.js";
import { join, resolve } from "node:path";
import { roastDocumentsAsync } from "./roast.js";
import type { RoastResult } from "./types.js";

export interface SuiteFileResult {
  path: string;
  score: number;
  label: string;
  kind: "prompt" | "answer";
  wordCount: number;
  error?: string;
}

export interface SuiteResult {
  version: string;
  files: SuiteFileResult[];
  stats: {
    count: number;
    maxScore: number;
    avgScore: number;
    failCount: number;
  };
}

function isRoastableFile(filename: string): boolean {
  return /\.(txt|md|markdown)$/i.test(filename);
}

function matchesPattern(filename: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  const regex = new RegExp(`^${escaped}$`, "i");
  return regex.test(filename);
}

async function expandGlob(pattern: string): Promise<string[]> {
  const resolved = resolve(pattern);
  
  try {
    const stats = await stat(resolved);
    if (stats.isDirectory()) {
      const entries = await readdir(resolved, { withFileTypes: true });
      const files = entries
        .filter((e) => e.isFile() && isRoastableFile(e.name))
        .map((e) => join(resolved, e.name));
      return files.sort();
    }
    
    if (stats.isFile()) {
      return [resolved];
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw err;
  }
  
  const lastSep = Math.max(pattern.lastIndexOf("/"), pattern.lastIndexOf("\\"));
  if (lastSep === -1 || pattern.includes("*") || pattern.includes("?")) {
    const dir = lastSep === -1 ? "." : pattern.slice(0, lastSep);
    const pat = lastSep === -1 ? pattern : pattern.slice(lastSep + 1);
    
    try {
      const dirResolved = resolve(dir);
      const entries = await readdir(dirResolved, { withFileTypes: true });
      const matches = entries
        .filter((e) => e.isFile() && matchesPattern(e.name, pat))
        .map((e) => join(dirResolved, e.name));
      return matches.sort();
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return [];
      throw err;
    }
  }
  
  return [];
}

export async function processSuite(
  pattern: string,
  spicy: boolean,
  deepen: boolean,
  version: string,
): Promise<SuiteResult> {
  const files = await expandGlob(pattern);
  
  if (files.length === 0) {
    throw new Error(`--suite: no roastable files found matching: ${pattern}`);
  }
  
  if (files.length === 1) {
    throw new Error(`--suite: only 1 file found, need ≥2 files for batch mode: ${files[0]}`);
  }
  
  const results: SuiteFileResult[] = [];
  
  for (const filepath of files) {
    try {
      const text = await readSource(filepath, { used: false });
      const result: RoastResult = await roastDocumentsAsync(
        [{ text, kind: "auto", source: basename(filepath) }],
        spicy,
        deepen,
      );
      
      const target = result.targets[0];
      if (target) {
        results.push({
          path: filepath,
          score: target.score,
          label: target.label,
          kind: target.kind,
          wordCount: target.wordCount,
        });
      }
    } catch (err) {
      results.push({
        path: filepath,
        score: 0,
        label: "error",
        kind: "answer",
        wordCount: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  
  const successful = results.filter((r) => !r.error);
  const failCount = results.filter((r) => r.error).length;
  
  const maxScore = successful.length > 0 ? Math.max(...successful.map((r) => r.score)) : 0;
  const avgScore =
    successful.length > 0
      ? Math.round(successful.reduce((sum, r) => sum + r.score, 0) / successful.length)
      : 0;
  
  return {
    version,
    files: results,
    stats: {
      count: results.length,
      maxScore,
      avgScore,
      failCount,
    },
  };
}
