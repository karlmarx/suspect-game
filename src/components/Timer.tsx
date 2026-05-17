import { useCountdown } from "../hooks/useCountdown";

interface TimerProps {
  endsAt: number | null;
  offsetMs: number;
  color?: string;
  label?: string;
}

export function Timer({ endsAt, offsetMs, color = "#fbbf24", label = "REMAINING" }: TimerProps) {
  const remaining = useCountdown(endsAt, offsetMs);
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return (
    <div className="font-mono text-center" style={{ color }}>
      <div className="font-bold" style={{ fontSize: 28 }}>
        {minutes}:{String(seconds).padStart(2, "0")}
      </div>
      <div className="text-muted tracking-widest" style={{ fontSize: 9, marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}
