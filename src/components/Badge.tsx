import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  color?: "pink" | "blue" | "amber" | "green" | "red" | "muted";
}

const COLOR_MAP: Record<NonNullable<BadgeProps["color"]>, { bg: string; fg: string; border: string }> = {
  pink: { bg: "rgba(244,114,182,0.10)", fg: "#f472b6", border: "rgba(244,114,182,0.25)" },
  blue: { bg: "rgba(56,189,248,0.10)", fg: "#38bdf8", border: "rgba(56,189,248,0.25)" },
  amber: { bg: "rgba(251,191,36,0.10)", fg: "#fbbf24", border: "rgba(251,191,36,0.25)" },
  green: { bg: "rgba(74,222,128,0.10)", fg: "#4ade80", border: "rgba(74,222,128,0.25)" },
  red: { bg: "rgba(239,68,68,0.10)", fg: "#ef4444", border: "rgba(239,68,68,0.25)" },
  muted: { bg: "rgba(100,116,139,0.10)", fg: "#64748b", border: "rgba(100,116,139,0.25)" },
};

export function Badge({ children, color = "pink" }: BadgeProps) {
  const c = COLOR_MAP[color];
  return (
    <span
      className="inline-block rounded-full font-mono uppercase tracking-[0.12em]"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        fontSize: 11,
        fontWeight: 700,
        padding: "4px 12px",
      }}
    >
      {children}
    </span>
  );
}
