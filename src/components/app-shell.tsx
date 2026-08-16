import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  ClipboardList,
  LayoutDashboard,
  MessageSquareText,
  Shield,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { signOut } from "@/lib/auth/client";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { ROLE_META, type Profile, type UserRole } from "@/lib/knowledge/types";
import { getProfile, setRole } from "@/lib/server/rag";
import { cn } from "@/lib/utils";
import { RoleSwitcher } from "./role-switcher";

const NAV = [
  { to: "/", label: "Ask", icon: MessageSquareText },
  { to: "/library", label: "Library", icon: BookOpen },
  { to: "/audit", label: "Audit", icon: ClipboardList },
  { to: "/evals", label: "Evals", icon: LayoutDashboard },
  { to: "/admin", label: "Admin", icon: Shield },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roleBusy, setRoleBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    void getProfile()
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [user]);

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <div className="h-28 w-56 rounded-xl shimmer" />
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;

  async function onRole(role: UserRole) {
    setRoleBusy(true);
    try {
      const next = await setRole({ data: { role } });
      setProfile(next);
    } finally {
      setRoleBusy(false);
    }
  }

  const label = user.displayName ?? user.primaryEmail ?? "Account";
  const role = profile?.role ?? "field_engineer";

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col bg-surface shadow-[1px_0_0_0_rgb(255_255_255/0.06)] lg:flex">
        <div className="px-5 pt-7 pb-5">
          <p className="kicker">SwiftRoute</p>
          <p className="mt-1 font-display text-2xl font-medium">Kendra</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {NAV.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors duration-150",
                  active
                    ? "bg-elevated text-fg"
                    : "text-muted hover:bg-elevated/60 hover:text-fg",
                )}
              >
                <Icon className="size-4" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border px-4 py-4">
          <p className="truncate text-sm font-medium">{label}</p>
          <button
            type="button"
            onClick={() => void signOut("/login")}
            className="mt-1 text-xs text-muted underline-offset-4 hover:text-fg hover:underline"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-bg/80 px-4 py-3 backdrop-blur-md lg:px-8">
          <div className="min-w-0">
            <p className="font-display text-lg font-medium leading-none lg:hidden">Kendra</p>
            <div className="hidden items-center gap-2 text-xs text-muted lg:flex">
              <span className="size-1.5 rounded-full bg-ok" />
              <span>Permission filter on</span>
              <span className="text-subtle">·</span>
              <span className="truncate">{ROLE_META[role].label}</span>
            </div>
          </div>
          <RoleSwitcher value={role} busy={roleBusy || !profile} onChange={(r) => void onRole(r)} />
        </header>

        <div
          key={role}
          className="px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:px-8 lg:pt-7 lg:pb-12"
        >
          {children}
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 bg-surface/95 shadow-[0_-1px_0_0_rgb(255_255_255/0.06)] backdrop-blur-md lg:hidden pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-xs",
                    active ? "text-fg" : "text-subtle",
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2 : 1.6} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
