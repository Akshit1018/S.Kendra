import { createFileRoute } from "@tanstack/react-router";
import { ArrowUp, ThumbsDown, ThumbsUp } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SUGGESTED_QUERIES } from "@/lib/knowledge/corpus";
import type { Citation, QueryResult } from "@/lib/knowledge/types";
import { askKnowledge, submitFeedback } from "@/lib/server/rag";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: AskPage });

const STEPS = ["Auth context", "Hybrid retrieve", "Rerank + cite", "Grounded answer"] as const;

function citeIndex(answer: string, citations: Citation[]) {
  const map = new Map<string, number>();
  let n = 0;
  for (const c of citations) {
    if (!map.has(c.chunkId)) {
      n += 1;
      map.set(c.chunkId, n);
    }
  }
  for (const m of answer.matchAll(/\[([a-z0-9_]+)\]/gi)) {
    const id = m[1];
    if (!map.has(id)) {
      n += 1;
      map.set(id, n);
    }
  }
  return map;
}

function AskPage() {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rated, setRated] = useState<"up" | "down" | null>(null);
  const [openCite, setOpenCite] = useState<string | null>(null);

  async function run(q: string) {
    const text = q.trim();
    if (text.length < 3 || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setRated(null);
    setOpenCite(null);
    setStep(0);
    const tick = window.setInterval(() => {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, 320);
    try {
      const res = await askKnowledge({ data: { query: text } });
      setResult(res);
      setStep(STEPS.length - 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed");
    } finally {
      window.clearInterval(tick);
      setBusy(false);
    }
  }

  const numbers = useMemo(
    () => (result ? citeIndex(result.answer, result.citations) : new Map<string, number>()),
    [result],
  );

  const paragraphs = useMemo(() => {
    if (!result) return null;
    return result.answer.split(/\n{2,}/).map((para, pi) => (
      <p key={pi} className="text-pretty">
        {para.split(/(\[[a-z0-9_]+\])/gi).map((part, i) => {
          const m = part.match(/^\[([a-z0-9_]+)\]$/i);
          if (!m) return <span key={i}>{part}</span>;
          const id = m[1];
          const num = numbers.get(id) ?? "·";
          return (
            <button
              key={i}
              type="button"
              onClick={() => setOpenCite(id)}
              className="mx-0.5 inline-flex h-5 min-w-5 translate-y-[-1px] items-center justify-center rounded-xs bg-elevated px-1 align-super font-mono text-xs text-accent"
            >
              {num}
            </button>
          );
        })}
      </p>
    ));
  }, [result, numbers]);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <PageHeader kicker="Ask" title="What do you need on site?">
          Answers stay inside your role. Switch the header role to see a field
          engineer blocked from confidential security files.
        </PageHeader>

        <form
          className="animate-fade-up stagger-3 mt-7"
          onSubmit={(e) => {
            e.preventDefault();
            void run(query);
          }}
        >
          <div className="rounded-xl bg-surface p-2 shadow-border">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={3}
              placeholder="Damaged package at last-mile hub…"
              className="w-full resize-none bg-transparent px-3 py-2 text-base text-fg outline-none placeholder:text-subtle"
            />
            <div className="flex items-center justify-between px-1 pb-1">
              <span className="px-2 text-xs text-subtle tabular-nums">
                {query.trim().length}/1000
              </span>
              <button
                type="submit"
                disabled={busy || query.trim().length < 3}
                className="inline-flex h-11 items-center gap-2 rounded-md bg-accent pr-3.5 pl-4 text-sm font-semibold text-accent-fg transition-transform duration-150 disabled:opacity-40 active:scale-[0.96]"
              >
                {busy ? "Retrieving" : "Ask"}
                <ArrowUp className="size-4" />
              </button>
            </div>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTED_QUERIES.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => {
                setQuery(s.query);
                void run(s.query);
              }}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-elevated px-3.5 text-xs text-fg shadow-border transition-[box-shadow] duration-150 hover:shadow-border-hover"
            >
              {s.label}
              <span className="text-subtle">{s.hint}</span>
            </button>
          ))}
        </div>

        {busy && (
          <div className="mt-8 space-y-3">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-3 text-sm">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    i <= step ? "bg-ok" : "bg-border-strong",
                  )}
                />
                <span className={i <= step ? "text-fg" : "text-subtle"}>{label}</span>
              </div>
            ))}
            <div className="mt-4 h-28 rounded-xl shimmer" />
          </div>
        )}

        {error && <p className="mt-6 text-sm text-danger">{error}</p>}

        {result && !busy && (
          <article className="animate-fade-up mt-8">
            <div
              className={cn(
                "rounded-xl p-5 sm:p-6",
                result.escalate ? "bg-elevated shadow-border" : "bg-surface shadow-border",
              )}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs tracking-wide text-subtle uppercase">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5",
                    result.escalate
                      ? "bg-warn/15 text-warn"
                      : result.confidence === "high"
                        ? "bg-ok/15 text-ok"
                        : "bg-bg text-muted",
                  )}
                >
                  {result.escalate ? "Escalate" : `${result.confidence} confidence`}
                </span>
                <span className="tabular-nums">{result.latencyMs} ms</span>
                <span className="normal-case tracking-normal text-subtle">
                  {result.modelUsed === "grok-4.5" ? "Grok" : "Grounded extract"}
                </span>
              </div>
              <div className="mt-4 space-y-3 text-base leading-relaxed text-fg">
                {paragraphs}
              </div>
              {result.warning && <p className="mt-3 text-sm text-warn">{result.warning}</p>}
              <div className="mt-5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRated("up");
                    void submitFeedback({ data: { auditId: result.auditId, rating: "up" } });
                  }}
                  className={cn(
                    "inline-flex size-11 items-center justify-center rounded-md bg-elevated shadow-border",
                    rated === "up" ? "text-ok" : "text-muted",
                  )}
                  aria-label="Helpful"
                >
                  <ThumbsUp className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRated("down");
                    void submitFeedback({ data: { auditId: result.auditId, rating: "down" } });
                  }}
                  className={cn(
                    "inline-flex size-11 items-center justify-center rounded-md bg-elevated shadow-border",
                    rated === "down" ? "text-danger" : "text-muted",
                  )}
                  aria-label="Not helpful"
                >
                  <ThumbsDown className="size-4" />
                </button>
                <span className="ml-auto font-mono text-xs text-subtle">{result.auditId}</span>
              </div>
            </div>

            {result.citations.length > 0 && (
              <div className="mt-7">
                <h2 className="kicker">Citations</h2>
                <ul className="mt-3 space-y-2">
                  {result.citations.map((c) => {
                    const open = openCite === c.chunkId;
                    const num = numbers.get(c.chunkId);
                    return (
                      <li key={c.chunkId}>
                        <button
                          type="button"
                          onClick={() => setOpenCite(open ? null : c.chunkId)}
                          className="w-full rounded-lg bg-elevated p-4 text-left shadow-border transition-[box-shadow] duration-150 hover:shadow-border-hover"
                        >
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-xs bg-surface font-mono text-xs tabular-nums">
                              {num ?? "·"}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">{c.documentTitle}</p>
                              <p className="mt-0.5 text-xs text-muted">
                                {c.section}
                                {c.page ? ` · p.${c.page}` : ""}
                              </p>
                              {open && (
                                <p className="mt-3 text-sm leading-relaxed text-muted">
                                  {c.snippet}
                                </p>
                              )}
                            </div>
                            <span className="font-mono text-xs text-subtle tabular-nums">
                              {c.score.toFixed(2)}
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </article>
        )}
      </div>
    </AppShell>
  );
}
