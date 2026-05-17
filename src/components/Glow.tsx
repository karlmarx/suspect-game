interface GlowProps {
  color: string;
  size?: number;
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
  opacity?: number;
}

export function Glow({
  color,
  size = 300,
  top,
  left,
  right,
  bottom,
  opacity = 0.08,
}: GlowProps) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        top,
        left,
        right,
        bottom,
        width: size,
        height: size,
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        opacity,
        filter: "blur(40px)",
      }}
    />
  );
}
