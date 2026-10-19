import { Link } from "@tanstack/react-router";
import { DemoNotice } from "./DemoNotice";
import type { ReactNode } from "react";
import { Logo } from "./ui";

function BoardIllustration() {
  const columns = [
    { label: "To do", tone: "bg-white/70", cards: [3, 2] },
    { label: "In progress", tone: "bg-sky-200", cards: [2, 3] },
    { label: "Review", tone: "bg-amber-200", cards: [2] },
    { label: "Done", tone: "bg-emerald-200", cards: [3, 2, 2] },
  ];
  return (
    <div className="grid grid-cols-4 gap-2.5" aria-hidden="true">
      {columns.map((column) => (
        <div key={column.label} className="rounded-xl bg-white/10 p-2">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/75">
            <span className={`size-1.5 rounded-full ${column.tone}`} />
            {column.label}
          </div>
          <div className="space-y-1.5">
            {column.cards.map((lines, index) => (
              <div key={index} className="rounded-lg bg-white/90 p-2 shadow-sm">
                {Array.from({ length: lines }, (_, line) => (
                  <div
                    key={line}
                    className="mb-1 h-1.5 rounded-full bg-stone-300 last:mb-0"
                    style={{ width: `${90 - line * 22}%` }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-[#0d3b37] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 15%, rgba(94,234,212,.35), transparent 45%), radial-gradient(circle at 85% 80%, rgba(56,189,248,.25), transparent 40%)",
          }}
        />
        <Link to="/" className="relative">
          <Logo className="text-lg text-white" />
        </Link>
        <div className="relative max-w-md">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight">
            One board for the whole team, always in sync.
          </h2>
          <p className="mt-3 text-white/70">
            Plan work, assign owners, and watch every change land in real time for everyone on the project.
          </p>
          <div className="mt-10">
            <BoardIllustration />
          </div>
        </div>
        <p className="relative text-xs text-white/50">SWE40006 Group G05 project application</p>
      </aside>
      <main className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-sm animate-rise">
          <Link to="/" className="mb-10 inline-block lg:hidden">
            <Logo className="text-lg" />
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-1.5 text-sm text-ink-soft">{subtitle}</p> : null}
          <DemoNotice className="mt-6" />
          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-8 text-sm text-ink-soft">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}
