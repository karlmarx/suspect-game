import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface PageShellProps {
  children: ReactNode;
  subtitle?: string;
  roomCode?: string;
}

export function PageShell({ children, subtitle, roomCode }: PageShellProps) {
  return (
    <div className="min-h-screen text-text" style={{ background: "#0a0a0f" }}>
      <div
        className="relative mx-auto flex min-h-screen flex-col overflow-hidden"
        style={{ maxWidth: 560 }}
      >
        <header className="flex items-center justify-between px-5 pt-4">
          <Link
            to="/"
            className="font-mono font-bold tracking-[0.3em] text-text no-underline"
            style={{ fontSize: 14 }}
          >
            SUSPECT
          </Link>
          {roomCode ? (
            <div className="font-mono uppercase tracking-[0.25em]" style={{ fontSize: 11, color: "#64748b" }}>
              ROOM <span style={{ color: "#e2e8f0" }}>{roomCode}</span>
            </div>
          ) : subtitle ? (
            <div className="font-mono uppercase tracking-[0.18em]" style={{ fontSize: 10, color: "#64748b" }}>
              {subtitle}
            </div>
          ) : null}
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
