import type { ButtonHTMLAttributes, ReactNode } from "react";

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "success" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

const VARIANTS: Record<
  NonNullable<PrimaryButtonProps["variant"]>,
  { bg: string; color: string; border: string }
> = {
  primary: {
    bg: "linear-gradient(135deg, #f472b6, #c084fc)",
    color: "#fff",
    border: "none",
  },
  success: {
    bg: "linear-gradient(135deg, #4ade80, #22d3ee)",
    color: "#000",
    border: "none",
  },
  ghost: {
    bg: "transparent",
    color: "#e2e8f0",
    border: "1.5px solid #334155",
  },
  danger: {
    bg: "#ef4444",
    color: "#fff",
    border: "none",
  },
};

const SIZES: Record<NonNullable<PrimaryButtonProps["size"]>, { pad: string; fs: number }> = {
  sm: { pad: "8px 18px", fs: 12 },
  md: { pad: "12px 28px", fs: 13 },
  lg: { pad: "14px 36px", fs: 14 },
};

export function PrimaryButton({
  children,
  variant = "primary",
  size = "md",
  style,
  disabled,
  ...rest
}: PrimaryButtonProps) {
  const v = VARIANTS[variant];
  const s = SIZES[size];
  return (
    <button
      {...rest}
      disabled={disabled}
      className="font-mono uppercase tracking-[0.18em] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        background: v.bg,
        color: v.color,
        border: v.border,
        borderRadius: 10,
        padding: s.pad,
        fontSize: s.fs,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
