import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { getEvalReport } from "@/lib/server/rag";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/evals")({ component: EvalsPage });

type Report = Awaited<ReturnType<typeof getEvalReport>>;

function EvalsPage() {
  const [data, setData] = useState<Report | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void getEvalReport()
      .then(setData)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Failed"));
  }, []);

  const s = data?.evals.summary;
  const live = data?.live;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <PageHeader kicker="Evaluation" title="Quality gate">
          Golden set plus live query stats. Permission leaks must stay at zero.
        </PageHeader>
        {err && <p className="mt-3 text-sm text-danger">{err}</p>}

        {!data && !err && (
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl shimmer" />
            ))}
          </div>
        )}

        {s && (
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Faithfulness" value={s.faithfulnessProxy.toFixed(2)} target="≥ 0.85" />
            <Stat label="Relevancy" value={s.relevancyProxy.toFixed(2)} target="≥ 0.80" />
            <Stat label="Precision" value={s.contextPrecision.toFixed(2)} target="≥ 0.75" />
            <Stat
              label="Leaks"
              value={String(s.leakCount)}
              target="0"
              danger={s.leakCount > 0}
            />
          </div>
        )}

        {live && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Live queries" value={String(live.queries)} target="session" />
            <Stat label="Avg latency" value={`${live.avgLatency} ms`} target="< 4s" />
            <Stat
              label="Escalate rate"
              value={live.escalateRate.toFixed(2)}
              target="expected on restricted"
            />
            <Stat
              label="Feedback"
              value={`${live.thumbsUp}/${live.thumbsDown}`}
              target="up / down"
            />
          </div>
        )}

        {data && (
          <div className="mt-8 overflow-x-auto rounded-xl bg-surface shadow-border">
            <table className="w-full min-w-xl text-left text-sm">
              <thead className="bg-elevated text-xs tracking-wide text-subtle uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Case</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Pass</th>
                  <th className="px-4 py-3 font-medium">P / R</th>
                </tr>
              </thead>
              <tbody>
                {data.evals.rows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="max-w-xs">{r.query}</p>
                      {r.mustEscalate && <p className="text-xs text-warn">must not leak</p>}
                    </td>
                    <td className="px-4 py-3 text-muted">{r.role.replace("_", " ")}</td>
                    <td className="px-4 py-3">
                      <span className={r.pass ? "text-ok" : "text-danger"}>
                        {r.pass ? "pass" : "fail"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums text-muted">
                      {r.precision.toFixed(2)} / {r.recall.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  target,
  danger,
}: {
  label: string;
  value: string;
  target: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl bg-surface p-4 shadow-border">
      <p className="text-xs tracking-wide text-subtle uppercase">{label}</p>
      <p
        className={cn(
          "mt-1 font-display text-2xl tabular-nums",
          danger ? "text-danger" : "text-fg",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-subtle">{target}</p>
    </div>
  );
}
