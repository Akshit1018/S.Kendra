import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { ACCESS_LEVELS, DEPARTMENTS, ROLE_META, type Profile } from "@/lib/knowledge/types";
import { getProfile, uploadDocument } from "@/lib/server/rag";

export const Route = createFileRoute("/admin")({ component: AdminPage });

function AdminPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [department, setDepartment] = useState("logistics");
  const [accessLevel, setAccessLevel] = useState("internal");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getProfile().then(setProfile);
  }, []);

  const allowed =
    profile?.role === "knowledge_admin" || profile?.role === "security_admin";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await uploadDocument({
        data: { title, content, department, accessLevel },
      });
      setMsg(`Indexed ${r.id}. It will appear in Ask and Library for allowed roles.`);
      setTitle("");
      setContent("");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <PageHeader kicker="Admin" title="Ingest and ACL">
          Knowledge and security admins can add a note. ACL is stored with the
          document and enforced on retrieve.
        </PageHeader>

        {profile && !allowed && (
          <div className="mt-8 rounded-xl bg-elevated p-5 text-sm text-muted shadow-border">
            Viewing as {ROLE_META[profile.role].label}. Switch to Knowledge Admin
            in the header to upload.
          </div>
        )}

        {allowed && (
          <form onSubmit={onSubmit} className="mt-7 space-y-4">
            <label className="block text-sm">
              <span className="mb-1.5 block text-muted">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="field"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-muted">Body</span>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                rows={8}
                className="w-full rounded-md bg-bg px-3 py-2 text-fg shadow-border outline-none focus:shadow-[0_0_0_1px_var(--color-ring)]"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="mb-1.5 block text-muted">Department</span>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="field"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-muted">Access</span>
                <select
                  value={accessLevel}
                  onChange={(e) => setAccessLevel(e.target.value)}
                  className="field"
                >
                  {ACCESS_LEVELS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="h-11 rounded-md bg-accent px-5 text-sm font-semibold text-accent-fg disabled:opacity-50 active:scale-[0.96]"
            >
              {busy ? "Indexing…" : "Index document"}
            </button>
            {msg && <p className="text-sm text-muted">{msg}</p>}
          </form>
        )}
      </div>
    </AppShell>
  );
}
