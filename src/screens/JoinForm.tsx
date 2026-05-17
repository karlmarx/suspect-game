import { useState } from "react";
import { Glow } from "../components/Glow";
import { PrimaryButton } from "../components/PrimaryButton";

const EMOJIS = ["🎭", "🧘", "⚡", "🎯", "🔬", "🦊", "🐙", "🌮", "🍻", "🎲", "🚀", "👑", "🤡", "🔮", "🎸"];

interface JoinFormProps {
  roomCode: string;
  initialName?: string;
  initialEmoji?: string;
  onJoin: (name: string, emoji: string) => void;
  error: string | null;
}

export function JoinForm({ roomCode, initialName = "", initialEmoji = "🎭", onJoin, error }: JoinFormProps) {
  const [name, setName] = useState(initialName);
  const [emoji, setEmoji] = useState(initialEmoji);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length === 0) return;
    onJoin(name.trim(), emoji);
  };

  return (
    <div className="relative px-6 py-8">
      <Glow color="#f472b6" size={300} top={-60} left="20%" opacity={0.06} />
      <div className="text-center" style={{ marginBottom: 24 }}>
        <div
          className="font-mono uppercase tracking-[0.25em]"
          style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}
        >
          JOINING ROOM
        </div>
        <div
          className="font-mono font-bold text-glow-pink"
          style={{ fontSize: 44, letterSpacing: 14, color: "#e2e8f0" }}
        >
          {roomCode}
        </div>
      </div>

      <form onSubmit={submit} className="mx-auto flex flex-col gap-4" style={{ maxWidth: 340 }}>
        <div>
          <div
            className="font-mono uppercase tracking-widest"
            style={{ fontSize: 10, color: "#64748b", marginBottom: 8 }}
          >
            YOUR NAME
          </div>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 16))}
            placeholder="Name"
            className="w-full font-sans outline-none"
            style={{
              background: "#1e1e2e",
              border: "1.5px solid #334155",
              color: "#e2e8f0",
              borderRadius: 10,
              padding: "12px 16px",
              fontSize: 16,
            }}
          />
        </div>

        <div>
          <div
            className="font-mono uppercase tracking-widest"
            style={{ fontSize: 10, color: "#64748b", marginBottom: 8 }}
          >
            AVATAR
          </div>
          <div className="grid grid-cols-8 gap-1.5">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className="transition-all"
                style={{
                  background: emoji === e ? "rgba(244,114,182,0.18)" : "#1e1e2e",
                  border: `1.5px solid ${emoji === e ? "#f472b6" : "rgba(51,65,85,0.4)"}`,
                  borderRadius: 8,
                  padding: 6,
                  fontSize: 20,
                  cursor: "pointer",
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div
            className="font-mono"
            style={{
              color: "#ef4444",
              fontSize: 12,
              padding: "8px 12px",
              background: "rgba(239,68,68,0.08)",
              borderRadius: 8,
              border: "1px solid rgba(239,68,68,0.2)",
            }}
          >
            {error}
          </div>
        )}

        <PrimaryButton type="submit" size="lg" variant="primary" disabled={name.trim().length === 0}>
          JOIN GAME
        </PrimaryButton>
      </form>
    </div>
  );
}
