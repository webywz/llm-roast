import type { RoastResult } from "./types.js";

const TIMEOUT_MS = 8000;
const MAX_TEXT = 1800;

function findingsDigest(result: RoastResult): string {
  return result.targets
    .map((t) => {
      const top = t.findings
        .slice(0, 8)
        .map((f) => `- [${f.kind}] ${f.title}: ${f.detail}`)
        .join("\n");
      const sample = t.roast.slice(0, 400);
      return `## ${t.kind} (${t.source}) score=${t.score}\n${top}\nRoast so far: ${sample}`;
    })
    .join("\n\n");
}

function sampleText(result: RoastResult): string {
  // We don't have original text on the result; the roast + findings are enough.
  return findingsDigest(result).slice(0, MAX_TEXT);
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

function systemPrompt(spicy: boolean): string {
  return spicy
    ? "You write one short, cutting roast paragraph about an LLM prompt and/or answer. Witty, specific, a little mean, never bigoted or about the author's identity. Max 70 words. No markdown, no preface."
    : "You write one short, witty roast paragraph about an LLM prompt and/or answer. Punchy, specific, not cruel. Max 70 words. No markdown, no preface.";
}

async function openaiRoast(key: string, user: string, spicy: boolean): Promise<string | null> {
  const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.8,
      max_tokens: 180,
      messages: [
        { role: "system", content: systemPrompt(spicy) },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  return text || null;
}

async function anthropicRoast(key: string, user: string, spicy: boolean): Promise<string | null> {
  const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-latest",
      max_tokens: 180,
      temperature: 0.8,
      system: systemPrompt(spicy),
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = data.content?.find((c) => c.type === "text")?.text?.trim();
  return text || null;
}

/** One extra roast paragraph when an API key is present. Never throws. */
export async function maybeDeepen(result: RoastResult, spicy: boolean): Promise<string | undefined> {
  const openai = process.env.OPENAI_API_KEY?.trim();
  const anthropic = process.env.ANTHROPIC_API_KEY?.trim();
  if (!openai && !anthropic) return undefined;

  const user = `Heuristic roast score: ${result.score}/100 (${result.label}).\n\n${sampleText(result)}\n\nWrite the extra roast paragraph now.`;
  try {
    const paragraph = openai
      ? await openaiRoast(openai, user, spicy)
      : await anthropicRoast(anthropic!, user, spicy);
    return paragraph ?? undefined;
  } catch {
    return undefined;
  }
}
