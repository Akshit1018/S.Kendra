import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  GROK_PROVIDERS,
  authClient,
  authEnabled,
  signIn,
} from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isPending && user) {
    void navigate({ to: "/" });
  }

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "up") {
        const { error: err } = await authClient.signUp.email({
          email,
          password,
          name: name || email.split("@")[0] || "Field",
        });
        if (err) throw new Error(err.message ?? "Sign up failed");
      } else {
        const { error: err } = await authClient.signIn.email({ email, password });
        if (err) throw new Error(err.message ?? "Sign in failed");
      }
      await navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-bg text-fg">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_40%_at_8%_0%,color-mix(in_oklab,var(--color-fg)_5%,transparent),transparent_60%)]" />
      <div className="mx-auto grid min-h-dvh w-full max-w-6xl items-center gap-12 px-5 py-10 lg:grid-cols-2 lg:px-12">
        <section className="animate-fade-up hidden lg:block">
          <p className="kicker">SwiftRoute · Field knowledge</p>
          <h1 className="mt-5 max-w-md font-display text-5xl font-medium tracking-tight text-fg">
            Authorized answers. On the dock.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-muted">
            Kendra retrieves only what your role may see — SOPs, SLAs, and
            incident policy — then cites the page.
          </p>
          <ul className="mt-9 space-y-3 text-sm text-muted">
            {[
              "Hybrid retrieval under role filters",
              "Mandatory citations, never a bare claim",
              "Full audit of every query",
            ].map((line) => (
              <li key={line} className="flex gap-3">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                {line}
              </li>
            ))}
          </ul>
        </section>

        <section className="animate-fade-up stagger-2 mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <p className="kicker">SwiftRoute</p>
            <h1 className="mt-2 font-display text-3xl font-medium">Kendra</h1>
            <p className="mt-2 text-sm text-muted">Sign in to ask the library.</p>
          </div>

          <div className="rounded-xl bg-surface p-6 shadow-border sm:p-8">
            <h2 className="font-display text-2xl font-medium">
              {mode === "up" ? "Create account" : "Sign in"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Work account first. Then pick a role to demo permissions.
            </p>

            {authEnabled ? (
              <div className="mt-6 space-y-2">
                {GROK_PROVIDERS.map((p) => (
                  <button
                    key={p.providerId}
                    type="button"
                    onClick={() => signIn(p.providerId, { callbackURL: "/" })}
                    className="flex h-11 w-full items-center justify-center rounded-md bg-elevated text-sm font-medium text-fg shadow-border transition-[box-shadow,transform] duration-150 hover:shadow-border-hover active:scale-[0.96]"
                  >
                    Continue with {p.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">Sign-in is disabled.</p>
            )}

            <div className="my-5 flex items-center gap-3 text-xs tracking-wider text-subtle uppercase">
              <span className="h-px flex-1 bg-border" />
              Email
              <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={onEmail} className="space-y-3">
              {mode === "up" && (
                <label className="block text-sm">
                  <span className="mb-1.5 block text-muted">Name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="field"
                    autoComplete="name"
                  />
                </label>
              )}
              <label className="block text-sm">
                <span className="mb-1.5 block text-muted">Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field"
                  autoComplete="email"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-muted">Password</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field"
                  autoComplete={mode === "up" ? "new-password" : "current-password"}
                />
              </label>
              {error && <p className="text-sm text-danger">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="flex h-11 w-full items-center justify-center rounded-md bg-accent text-sm font-semibold text-accent-fg transition-transform duration-150 disabled:opacity-50 active:scale-[0.96]"
              >
                {busy ? "Working…" : mode === "up" ? "Create account" : "Sign in with email"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => setMode(mode === "up" ? "in" : "up")}
              className="mt-4 w-full text-center text-sm text-muted underline-offset-4 hover:text-fg hover:underline"
            >
              {mode === "up" ? "Have an account? Sign in" : "New here? Create an account"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
