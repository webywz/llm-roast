import { appendFileSync } from "node:fs";
import type { Finding, RoastResult, Severity } from "./types.js";

export interface GitHubFormatOptions {
  /** Soft cap for PR annotation noise. Default 20. */
  maxAnnotations?: number;
}

type AnnotationType = "error" | "warning" | "notice";

/** Escape payload text for workflow command messages. */
export function escapeData(value: string): string {
  return value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

/** Escape workflow command property values (file, title, …). */
export function escapeProperty(value: string): string {
  return escapeData(value).replace(/:/g, "%3A").replace(/,/g, "%2C");
}

export function annotation(
  type: AnnotationType,
  message: string,
  props: { file?: string; line?: number; title?: string } = {},
): string {
  const parts: string[] = [];
  if (props.file) parts.push(`file=${escapeProperty(props.file)}`);
  if (props.line !== undefined && Number.isFinite(props.line)) {
    parts.push(`line=${Math.max(1, Math.trunc(props.line))}`);
  }
  if (props.title) parts.push(`title=${escapeProperty(props.title)}`);
  const meta = parts.length > 0 ? ` ${parts.join(",")}` : "";
  return `::${type}${meta}::${escapeData(message)}`;
}

function severityAnnotationType(severity: Severity): AnnotationType {
  switch (severity) {
    case "high":
      return "error";
    case "medium":
      return "warning";
    case "low":
      return "notice";
  }
}

function scoreAnnotationType(score: number): AnnotationType {
  if (score >= 75) return "error";
  if (score >= 50) return "warning";
  return "notice";
}

const SEVERITY_RANK: Record<Severity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function findingMessage(finding: Finding): string {
  const snip = finding.snippet ? ` — ${finding.snippet}` : "";
  return `${finding.title}: ${finding.detail}${snip}`;
}

/**
 * Emit GitHub Actions workflow commands so PR Checks show roast findings.
 * Offline / local-safe: pure string formatting, no network.
 */
export function formatGitHubAnnotations(
  result: RoastResult,
  options: GitHubFormatOptions = {},
): string {
  const max = options.maxAnnotations ?? 20;
  const lines: string[] = [];
  const push = (line: string): void => {
    if (lines.length < max) lines.push(line);
  };

  const primary = result.targets[0];
  const file = primary?.source && primary.source !== "stdin" ? primary.source : undefined;

  push(
    annotation(
      scoreAnnotationType(result.score),
      `Roast Score ${result.score}/100 (${result.label})${result.summary ? ` — ${result.summary}` : ""}`,
      { file, title: "llm-roast · score" },
    ),
  );

  const findings = result.targets
    .flatMap((t) =>
      t.findings.map((f) => ({
        finding: f,
        file: t.source && t.source !== "stdin" ? t.source : file,
      })),
    )
    .sort((a, b) => SEVERITY_RANK[a.finding.severity] - SEVERITY_RANK[b.finding.severity]);

  for (const { finding, file: f } of findings) {
    push(
      annotation(severityAnnotationType(finding.severity), findingMessage(finding), {
        file: f,
        line: finding.line,
        title: `llm-roast · ${finding.kind}`,
      }),
    );
  }

  return lines.length > 0 ? `${lines.join("\n")}\n` : "";
}

/** Append job outputs when running inside Actions (`GITHUB_OUTPUT`). */
export function appendGitHubJobOutput(result: RoastResult): void {
  const path = process.env.GITHUB_OUTPUT;
  if (!path) return;
  const body = [
    `score=${result.score}`,
    `label=${result.label}`,
    `findings=${result.targets.reduce((n, t) => n + t.findings.length, 0)}`,
  ].join("\n");
  appendFileSync(path, `${body}\n`, "utf8");
}
