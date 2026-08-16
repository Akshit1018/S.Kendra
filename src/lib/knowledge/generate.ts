import { tokenize, type Retrieved } from "./retrieve";
import type { Citation } from "./types";

const ESCALATE =
  "I do not have authorized information for this query under your current role. Please escalate.";

export function extractiveAnswer(query: string, retrieved: Retrieved[]): {
  answer: string;
  citations: Citation[];
  confidence: "high" | "medium" | "low" | "none";
  escalate: boolean;
  warning: string | null;
  modelUsed: string;
} {
  if (retrieved.length === 0) {
    return {
      answer: ESCALATE,
      citations: [],
      confidence: "none",
      escalate: true,
      warning: "No authorized chunks matched this query.",
      modelUsed: "grounded-extract",
    };
  }

  const qTokens = new Set(tokenize(query));
  const scored = retrieved.map((r) => {
    const sentences = r.chunk.content
      .split(/(?<=[.!?।])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20);
    const best = sentences
      .map((s) => {
        const overlap = tokenize(s).filter((t) => qTokens.has(t)).length;
        return { s, overlap };
      })
      .sort((a, b) => b.overlap - a.overlap)[0];
    return { r, sentence: best?.s ?? r.chunk.content.slice(0, 220), overlap: best?.overlap ?? 0 };
  });

  const picked = scored
    .filter((x) => x.overlap > 0 || scored.every((y) => y.overlap === 0))
    .sort((a, b) => b.overlap - a.overlap || b.r.score - a.r.score)
    .slice(0, 3);

  const answer = picked.map((x) => `${x.sentence} [${x.r.chunk.id}]`).join("\n\n");
  const maxScore = retrieved[0]?.score ?? 0;
  const confidence = maxScore > 6 ? "high" : maxScore > 3 ? "medium" : "low";

  return {
    answer,
    citations: picked.map((x) => x.r.citation),
    confidence,
    escalate: false,
    warning: confidence === "low" ? "Low retrieval score — verify against the source SOP." : null,
    modelUsed: "extractive-fallback",
  };
}

export async function groundedGenerate(
  query: string,
  retrieved: Retrieved[],
  role: string,
): Promise<{
  answer: string;
  citations: Citation[];
  confidence: "high" | "medium" | "low" | "none";
  escalate: boolean;
  warning: string | null;
  modelUsed: string;
}> {
  if (retrieved.length === 0) {
    return extractiveAnswer(query, retrieved);
  }

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return extractiveAnswer(query, retrieved);

  const context = retrieved
    .map(
      (r, i) =>
        `[${r.chunk.id}] (${r.citation.documentTitle}, p.${r.chunk.page}, ${r.chunk.section})\n${r.chunk.content}`,
    )
    .join("\n\n");

  const system = `You are Kendra, the permission-aware knowledge assistant for SwiftRoute, an Indian last-mile logistics company.
Answer ONLY using the provided context chunks.
If the context is insufficient, reply with exactly this sentence and nothing else:
${ESCALATE}
For every factual claim, cite the chunk id in square brackets like [chk_lm042_02].
Be concise. Use short paragraphs. Keep Indian terms (hub, COD, OTP, RTO) as-is.
Do not invent policy numbers, times, or rupee amounts that are not in context.
User role: ${role}`;

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.2,
        max_tokens: 420,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `Context:\n${context}\n\nQuery: ${query}\n\nAnswer with citations:`,
          },
        ],
      }),
    });

    if (!res.ok) return extractiveAnswer(query, retrieved);

    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) return extractiveAnswer(query, retrieved);

    const escalate = text.includes("I do not have authorized information");
    const usedIds = new Set(
      [...text.matchAll(/\[([a-z0-9_]+)\]/gi)].map((m) => m[1]),
    );
    const citations = retrieved
      .filter((r) => usedIds.has(r.chunk.id) || usedIds.size === 0)
      .slice(0, 5)
      .map((r) => r.citation);

    return {
      answer: text,
      citations: escalate ? [] : citations.length ? citations : retrieved.slice(0, 3).map((r) => r.citation),
      confidence: escalate ? "none" : retrieved[0].score > 5 ? "high" : "medium",
      escalate,
      warning: null,
      modelUsed: "grok-4.5",
    };
  } catch {
    return extractiveAnswer(query, retrieved);
  }
}
