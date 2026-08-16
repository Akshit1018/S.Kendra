import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import type { AccessLevel, DocumentRecord } from "@/lib/knowledge/types";
import { getDocument, listLibrary } from "@/lib/server/rag";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/library")({ component: LibraryPage });

function LibraryPage() {
  const [docs, setDocs] = useState<(DocumentRecord & { uploaded?: boolean })[]>([]);
  const [blockedHint, setBlockedHint] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void listLibrary()
      .then((r) => {
        setDocs(r.documents);
        setBlockedHint(
          r.profile.role === "field_engineer" || r.profile.role === "support_agent"
            ? "Confidential security policies are hidden from this role."
            : null,
        );
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, []);

  async function open(id: string) {
    if (openId === id) {
      setOpenId(null);
      setBody(null);
      return;
    }
    setOpenId(id);
    setBody(null);
    try {
      const d = await getDocument({ data: { id } });
      setBody(d.chunks.map((c) => c.content).join("\n\n"));
    } catch (e) {
      setBody(e instanceof Error ? e.message : "Cannot open");
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <PageHeader kicker="Library" title="Visible knowledge">
          Row-level access is applied per role. Switch role to watch the set change.
        </PageHeader>
        {blockedHint && <p className="mt-4 text-sm text-warn">{blockedHint}</p>}
        {err && <p className="mt-3 text-sm text-danger">{err}</p>}

        {loading && (
          <div className="mt-6 space-y-2">
            <div className="h-24 rounded-xl shimmer" />
            <div className="h-24 rounded-xl shimmer" />
          </div>
        )}

        <ul className="mt-6 space-y-2">
          {docs.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => void open(d.id)}
                className="w-full rounded-xl bg-surface p-4 text-left shadow-border transition-[box-shadow] duration-150 hover:shadow-border-hover sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{d.title}</p>
                    <p className="mt-1 text-sm text-muted">{d.summary}</p>
                  </div>
                  <AccessBadge level={d.accessLevel} />
                </div>
                <p className="mt-3 text-xs text-subtle">
                  {d.sourceType.toUpperCase()} · {d.department} · v{d.version}
                  {d.uploaded ? " · uploaded" : ""}
                </p>
                {openId === d.id && body && (
                  <p className="mt-4 whitespace-pre-wrap border-t border-border pt-4 text-sm leading-relaxed text-muted">
                    {body}
                  </p>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}

function AccessBadge({ level }: { level: AccessLevel }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-xs tracking-wide uppercase",
        level === "confidential"
          ? "bg-danger/15 text-danger"
          : level === "role_restricted" || level === "department"
            ? "bg-warn/15 text-warn"
            : "bg-elevated text-muted",
      )}
    >
      {level.replace("_", " ")}
    </span>
  );
}
