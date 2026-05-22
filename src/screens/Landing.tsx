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

      <HowToPlay />

      <footer
        className="text-center font-mono"
        style={{
          marginTop: 28,
          marginBottom: 24,
          color: "#475569",
          fontSize: 11,
          letterSpacing: 1.5,
        }}
      >
        <a
          href="https://github.com/karlmarx/suspect-game"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#64748b", textDecoration: "none" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#e2e8f0")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
        >
          karlmarx/suspect-game ↗
        </a>
      </footer>
    </PageShell>
  );
}

function HowToPlay() {
  return (
    <section
      className="relative mx-auto px-6"
      style={{ maxWidth: 720, paddingTop: 24, paddingBottom: 8 }}
    >
      <div
        className="text-center font-mono uppercase"
        style={{
          fontSize: 11,
          letterSpacing: 6,
          color: "#475569",
          marginBottom: 24,
        }}
      >
        ── HOW TO PLAY ──
      </div>

      <div
        className="font-sans"
        style={{
          color: "#cbd5e1",
          fontSize: 15,
          lineHeight: 1.65,
          textAlign: "center",
          marginBottom: 28,
        }}
      >
        Everyone sees the same 4×4 grid of words. One word is the{" "}
        <strong style={{ color: "#38bdf8", letterSpacing: 1 }}>TARGET</strong>.
        Everyone knows it — <em>except</em> one player, the{" "}
        <strong style={{ color: "#fbbf24", letterSpacing: 1 }}>SUSPECT</strong>,
        who has to bluff their way through.
      </div>

      <ol
        className="font-sans"
        style={{
          color: "#cbd5e1",
          fontSize: 14,
          lineHeight: 1.7,
          listStyle: "none",
          padding: 0,
          margin: "0 auto 32px",
          maxWidth: 560,
        }}
      >
        <Step
          n="1"
          accent="#38bdf8"
          title="REVEAL"
          body="Innocents see the highlighted target word; the Suspect sees the grid with no highlight."
        />
        <Step
          n="2"
          accent="#f472b6"
          title="CLUE"
          body="Take turns giving a one-word clue that points at the target — without naming any grid word."
        />
        <Step
          n="3"
          accent="#38bdf8"
          title="DISCUSS"
          body="60 seconds of live Zoom chat. Who sounds suspiciously vague? Whose clue could fit anything?"
        />
        <Step
          n="4"
          accent="#ef4444"
          title="VOTE"
          body="Lock in who you think the Suspect is. Can't vote for yourself."
        />
        <Step
          n="5"
          accent="#fbbf24"
          title="GUESS"
          body="If caught, the Suspect gets one chance to guess the target word from the grid and steal the round."
        />
      </ol>

      <div
        className="mx-auto font-sans"
        style={{
          maxWidth: 520,
          background: "rgba(30,30,46,0.5)",
          border: "1px solid rgba(51,65,85,0.4)",
          borderRadius: 10,
          padding: "14px 18px",
          color: "#94a3b8",
          fontSize: 13,
          lineHeight: 1.55,
          marginBottom: 8,
        }}
      >
        <strong style={{ color: "#e2e8f0" }}>Scoring:</strong>{" "}
        <span style={{ color: "#4ade80" }}>+2</span> per correct vote ·{" "}
        <span style={{ color: "#fbbf24" }}>+3</span> if the Suspect escapes ·{" "}
        <span style={{ color: "#fbbf24" }}>+2</span> if they're caught but guess
        right · <span style={{ color: "#4ade80" }}>+1</span> for any Innocent
        who got zero votes.
      </div>

      <div
        className="text-center italic font-sans"
        style={{ color: "#64748b", fontSize: 12, marginTop: 16 }}
      >
        Best with Zoom or in person · 3–8 players · ~3 min per round
      </div>
    </section>
  );
}

function Step({
  n,
  accent,
  title,
  body,
}: {
  n: string;
  accent: string;
  title: string;
  body: string;
}) {
  return (
    <li
      className="flex items-start gap-3"
      style={{ marginBottom: 12 }}
    >
      <span
        className="font-mono font-bold"
        style={{
          minWidth: 28,
          height: 28,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: `${accent}22`,
          border: `1.5px solid ${accent}`,
          borderRadius: 8,
          color: accent,
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        {n}
      </span>
      <div style={{ flex: 1, textAlign: "left" }}>
        <span
          className="font-mono font-bold"
          style={{ color: accent, letterSpacing: 2, fontSize: 13, marginRight: 8 }}
        >
          {title}
        </span>
        <span style={{ color: "#94a3b8" }}>{body}</span>
      </div>
    </li>
  );
}
