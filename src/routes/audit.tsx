import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { ROLE_META, type UserRole } from "@/lib/knowledge/types";
import { listAudit } from "@/lib/server/rag";

export const Route = createFileRoute("/audit")({ component: AuditPage });

type Row = {
  id: string;
  user_id: string;
  user_role: string;
  query_text: string | null;
  retrieved_chunk_ids: string | null;
  answer_preview: string | null;
  latency_ms: number | null;
  escalate: boolean;
  model_used: string | null;
  created_at: string;
};

function AuditPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [admin, setAdmin] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void listAudit()
      .then((r) => {
        setRows(r.rows);
        setAdmin(
          r.profile.role === "knowledge_admin" || r.profile.role === "security_admin",
        );
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <PageHeader kicker="Audit" title="Immutable trail">
          {admin
            ? "Admins see every invocation. Append-only — nothing is edited."
            : "You see only your own queries."}
        </PageHeader>
        {err && <p className="mt-3 text-sm text-danger">{err}</p>}
        {loading && <div className="mt-6 h-28 rounded-xl shimmer" />}

        {!loading && rows.length === 0 && !err && (
          <p className="mt-10 text-sm text-muted">No queries yet. Ask something first.</p>
        )}

        <ul className="mt-6 space-y-2">
          {rows.map((r) => {
            const role = r.user_role as UserRole;
            return (
              <li key={r.id} className="rounded-xl bg-surface p-4 shadow-border sm:p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-subtle">
                  <span className="font-mono">{r.id}</span>
                  <span>{ROLE_META[role]?.label ?? r.user_role}</span>
                  <span className="tabular-nums">{r.latency_ms ?? 0} ms</span>
                  {r.escalate && <span className="text-warn">escalated</span>}
                </div>
                <p className="mt-2 text-sm font-medium">{r.query_text}</p>
                {r.answer_preview && (
                  <p className="mt-2 line-clamp-3 text-sm text-muted">{r.answer_preview}</p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </AppShell>
  );
}
