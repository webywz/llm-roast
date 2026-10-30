export type {
  Finding,
  FindingKind,
  FormatOptions,
  RoastOptions,
  RoastResult,
  Severity,
  TargetKind,
  TargetResult,
} from "./types.js";
export { roastText, roastDocuments, roastDocumentsAsync, VERSION } from "./roast.js";
export type { DocumentInput } from "./roast.js";
export { analyzeText, detectKind, scoreLabel } from "./scorer.js";
export { formatPretty, formatJson, wantsColor } from "./format.js";
export { formatHtml, escapeHtml } from "./html.js";
export { parseArgv, UsageError } from "./parse.js";
export {
  annotation,
  appendGitHubJobOutput,
  appendGitHubStepSummary,
  escapeData,
  escapeProperty,
  formatGitHubAnnotations,
  formatGitHubStepSummary,
} from "./github.js";
export type { GitHubFormatOptions } from "./github.js";
