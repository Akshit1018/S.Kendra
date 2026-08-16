import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ROLE_META, USER_ROLES, type UserRole } from "@/lib/knowledge/types";
import { cn } from "@/lib/utils";

export function RoleSwitcher({
  value,
  busy,
  onChange,
}: {
  value: UserRole;
  busy?: boolean;
  onChange: (role: UserRole) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const meta = ROLE_META[value];

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 max-w-[13.5rem] items-center gap-2 rounded-lg bg-elevated px-3 text-left shadow-border transition-[box-shadow] duration-150 hover:shadow-border-hover disabled:opacity-60"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium leading-tight">{meta.label}</span>
          <span className="block truncate text-xs text-subtle">{meta.department}</span>
        </span>
        <ChevronDown className="ml-1 size-4 shrink-0 text-subtle" strokeWidth={1.75} />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute top-[calc(100%+8px)] right-0 z-30 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl bg-surface py-1 shadow-border shadow-soft"
        >
          {USER_ROLES.map((role) => {
            const item = ROLE_META[role];
            const active = role === value;
            return (
              <li key={role}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(role);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors duration-150",
                    active ? "bg-elevated" : "hover:bg-elevated/70",
                  )}
                >
                  <Check
                    className={cn("mt-0.5 size-4 shrink-0", active ? "text-fg" : "text-transparent")}
                    strokeWidth={2}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted">{item.blurb}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
