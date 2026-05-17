import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Glow } from "../components/Glow";
import { PageShell } from "../components/PageShell";
import { PrimaryButton } from "../components/PrimaryButton";
import { generateRoomCode, isValidRoomCode } from "../lib/roomCode";

export function Landing() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"none" | "join">("none");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = () => {
    const c = generateRoomCode();
    navigate(`/room/${c}`);
  };

  const join = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!isValidRoomCode(trimmed)) {
      setError("Room code must be 4 letters");
      return;
    }
    navigate(`/room/${trimmed}`);
  };

  return (
    <PageShell subtitle="ONE WORD. ONE BLUFF.">
      <div
        className="relative flex flex-col items-center justify-center px-6"
        style={{ minHeight: 540 }}
      >
        <Glow color="#f472b6" size={400} top={-100} left="15%" />
        <Glow color="#38bdf8" size={350} bottom={-60} right="10%" />

        <h1
          className="relative font-mono font-bold"
          style={{
            fontSize: 56,
            letterSpacing: 12,
            color: "#e2e8f0",
            marginBottom: 8,
          }}
        >
          SUSPECT
          <span
            className="absolute"
            style={{
              bottom: -2,
              left: 0,
              right: 0,
              height: 3,
              background: "linear-gradient(90deg, #f472b6, #38bdf8)",
              borderRadius: 2,
            }}
          />
        </h1>
        <p
          className="italic"
          style={{ fontSize: 16, color: "#64748b", marginBottom: 36 }}
        >
          One word. One bluff. Who's faking it?
        </p>

        {mode === "none" ? (
          <div className="flex gap-3">
            <PrimaryButton size="lg" variant="primary" onClick={create}>
              CREATE ROOM
            </PrimaryButton>
            <PrimaryButton size="lg" variant="ghost" onClick={() => setMode("join")}>
              JOIN ROOM
            </PrimaryButton>
          </div>
        ) : (
          <form onSubmit={join} className="flex flex-col items-center gap-3">
            <input
              autoFocus
              value={code}
              onChange={(e) => {
                setError(null);
                setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4));
              }}
              maxLength={4}
              placeholder="CODE"
              className="text-center font-mono font-bold uppercase outline-none"
              style={{
                background: "#1e1e2e",
                border: `1.5px solid ${error ? "#ef4444" : "#334155"}`,
                color: "#e2e8f0",
                borderRadius: 10,
                padding: "16px 22px",
                fontSize: 28,
                letterSpacing: 12,
                width: 220,
              }}
            />
            {error && (
              <div className="font-mono" style={{ color: "#ef4444", fontSize: 12 }}>
                {error}
              </div>
            )}
            <div className="flex gap-3">
              <PrimaryButton type="submit" size="md" variant="primary" disabled={code.length !== 4}>
                JOIN
              </PrimaryButton>
              <PrimaryButton
                type="button"
                size="md"
                variant="ghost"
                onClick={() => {
                  setMode("none");
                  setError(null);
                  setCode("");
                }}
              >
                BACK
              </PrimaryButton>
            </div>
          </form>
        )}

        <div
          className="flex gap-6 font-sans"
          style={{ marginTop: 40, color: "#64748b", fontSize: 12 }}
        >
          <span>🎭 3-8 Players</span>
          <span>⏱ 3 min rounds</span>
          <span>🍻 Happy hour approved</span>
        </div>
      </div>
    </PageShell>
  );
}
