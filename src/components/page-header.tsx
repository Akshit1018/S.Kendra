import type { ReactNode } from "react";

export function PageHeader({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="animate-fade-up max-w-xl">
      <p className="kicker">{kicker}</p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight sm:text-4xl">
        {title}
      </h1>
      {children ? <div className="mt-2 text-sm leading-relaxed text-muted">{children}</div> : null}
    </header>
  );
}
