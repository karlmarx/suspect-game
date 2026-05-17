import { useEffect, useState } from "react";
import { Badge } from "../components/Badge";
import { Glow } from "../components/Glow";
import { PrimaryButton } from "../components/PrimaryButton";
import { Timer } from "../components/Timer";
import { WordGrid } from "../components/WordGrid";
import type { ClientMessage, PublicState } from "../shared/types";

interface RoundViewProps {
  state: PublicState;
  offsetMs: number;
  isHost: boolean;
  send: (msg: ClientMessage) => void;
  errorMessage: string | null;
  clearError: () => void;
}

export function RoundView({ state, offsetMs, isHost, send, errorMessage, clearError }: RoundViewProps) {
  const round = state.round;
  if (!round) {
    return (
      <div className="px-5 py-10 text-center font-mono" style={{ color: "#64748b" }}>
        Waiting for round to start…
      </div>
    );
  }

  const yourId = state.yourPlayerId;
  const isYourTurn =
    round.phase === "clue" && round.clueOrder[round.currentClueIndex] === yourId;
  const me = state.players.find((p) => p.id === yourId);

  // Auto-clear error after a few seconds
  useEffect(() => {
    if (!errorMessage) return;
    const t = setTimeout(clearError, 3500);
    return () => clearTimeout(t);
  }, [errorMessage, clearError]);

  const phaseTitle: Record<typeof round.phase, string> = {
    lobby: "LOBBY",
    reveal: "GET READY",
    clue: isYourTurn ? "YOUR TURN" : "CLUE PHASE",
    discuss: "DISCUSS",
    vote: "VOTE NOW",
    "suspect-guess": "SUSPECT'S GUESS",
    resolution: "RESULTS",
    finished: "GAME OVER",
  };

  const phaseColor: Record<typeof round.phase, "pink" | "blue" | "amber" | "green" | "red" | "muted"> = {
    lobby: "muted",
    reveal: "blue",
    clue: "pink",
    discuss: "blue",
    vote: "red",
    "suspect-guess": "amber",
    resolution: "green",
    finished: "amber",
  };

  return (
    <div className="relative px-5 py-5">
      {round.phase === "vote" && <Glow color="#ef4444" size={250} top={-60} left="25%" opacity={0.05} />}
      {round.phase === "reveal" && round.isYouSuspect && (
        <Glow color="#fbbf24" size={300} top={-60} right="-10%" opacity={0.08} />
      )}

      {/* Header strip */}
      <div className="flex items-start justify-between" style={{ marginBottom: 14 }}>
        <div className="flex flex-col gap-1.5">
          <Badge color={phaseColor[round.phase]}>{phaseTitle[round.phase]}</Badge>
          <div className="flex gap-2">
            <Badge color="muted">
              R{round.number} / {state.totalRounds}
            </Badge>
            <Badge color="muted">{round.category}</Badge>
          </div>
        </div>
        {round.phaseEndsAt &&
          (round.phase === "clue" ||
            round.phase === "discuss" ||
            round.phase === "vote" ||
            round.phase === "suspect-guess" ||
            round.phase === "reveal") && (
            <Timer
              endsAt={round.phaseEndsAt}
              offsetMs={offsetMs}
              color={
                round.phase === "vote" ? "#ef4444" : round.phase === "suspect-guess" ? "#fbbf24" : "#fbbf24"
              }
            />
          )}
      </div>

      {/* Role badge */}
      <RoleBanner round={round} me={me?.name ?? "?"} />

      {/* The grid (always visible) */}
      <WordGrid words={round.words} targetWord={round.targetWord} />

      {/* Per-phase UI */}
      <div style={{ marginTop: 18 }}>
        {round.phase === "reveal" && <RevealHint round={round} />}
        {round.phase === "clue" && (
          <CluePhase round={round} state={state} isYourTurn={isYourTurn} send={send} />
        )}
        {round.phase === "discuss" && (
          <DiscussPhase round={round} state={state} isHost={isHost} send={send} />
        )}
        {round.phase === "vote" && (
          <VotePhase round={round} state={state} send={send} />
        )}
        {round.phase === "suspect-guess" && (
          <SuspectGuessPhase round={round} send={send} />
        )}
        {round.phase === "resolution" && (
          <ResolutionPhase round={round} state={state} isHost={isHost} send={send} />
        )}
        {round.phase === "finished" && (
          <FinishedPhase state={state} isHost={isHost} send={send} />
        )}
      </div>

      {errorMessage && (
        <div
          className="fixed left-1/2 font-mono"
          style={{
            transform: "translateX(-50%)",
            bottom: 24,
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.4)",
            color: "#fca5a5",
            padding: "10px 18px",
            borderRadius: 10,
            fontSize: 13,
            zIndex: 100,
          }}
        >
          {errorMessage}
        </div>
      )}
    </div>
  );
}

function RoleBanner({ round, me }: { round: NonNullable<PublicState["round"]>; me: string }) {
  if (round.phase === "resolution" || round.phase === "finished") return null;
  if (round.isYouSuspect) {
    return (
      <div
        className="text-center font-sans"
        style={{
          background: "rgba(251,191,36,0.10)",
          border: "1px solid rgba(251,191,36,0.30)",
          borderRadius: 10,
          padding: "10px 16px",
          marginBottom: 14,
          fontSize: 14,
          color: "#fbbf24",
        }}
      >
        🎭 <strong>{me}</strong>, you are <strong>The Suspect</strong>. Blend in.
      </div>
    );
  }
  if (round.targetWord) {
    return (
      <div
        className="text-center font-sans"
        style={{
          background: "rgba(56,189,248,0.08)",
          border: "1px solid rgba(56,189,248,0.30)",
          borderRadius: 10,
          padding: "10px 16px",
          marginBottom: 14,
          fontSize: 14,
          color: "#38bdf8",
        }}
      >
        ✅ You are Innocent. The word is{" "}
        <strong style={{ color: "#e2e8f0", letterSpacing: 2 }}>{round.targetWord}</strong>
      </div>
    );
  }
  return null;
}

function RevealHint({ round }: { round: NonNullable<PublicState["round"]> }) {
  return (
    <div className="text-center font-sans italic" style={{ color: "#64748b", fontSize: 13 }}>
      {round.isYouSuspect
        ? "Study the grid. You'll need to bluff."
        : "Memorize the word. Don't make it obvious."}
    </div>
  );
}

function CluePhase({
  round,
  state,
  isYourTurn,
  send,
}: {
  round: NonNullable<PublicState["round"]>;
  state: PublicState;
  isYourTurn: boolean;
  send: (msg: ClientMessage) => void;
}) {
  const [clue, setClue] = useState("");
  const currentPlayer = state.players.find((p) => p.id === round.clueOrder[round.currentClueIndex]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const w = clue.trim();
    if (!w) return;
    send({ type: "submit-clue", word: w });
    setClue("");
  };

  return (
    <div className="mx-auto" style={{ maxWidth: 420 }}>
      {/* Turn order */}
      <div className="flex flex-wrap gap-1.5" style={{ marginBottom: 12 }}>
        {round.clueOrder.map((pid, i) => {
          const p = state.players.find((pp) => pp.id === pid);
          const done = i < round.currentClueIndex;
          const current = i === round.currentClueIndex;
          return (
            <div
              key={pid}
              className="font-mono"
              style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 100,
                background: current
                  ? "rgba(244,114,182,0.18)"
                  : done
                    ? "rgba(74,222,128,0.10)"
                    : "rgba(51,65,85,0.18)",
                border: `1px solid ${
                  current ? "#f472b6" : done ? "rgba(74,222,128,0.30)" : "rgba(51,65,85,0.30)"
                }`,
                color: current ? "#f472b6" : done ? "#4ade80" : "#64748b",
                letterSpacing: 1,
              }}
            >
              {done ? "✓" : current ? "▶" : i + 1} {p?.emoji} {p?.name}
            </div>
          );
        })}
      </div>

      {/* Clue feed */}
      <div style={{ marginBottom: 12 }}>
        <div
          className="font-mono uppercase tracking-widest"
          style={{ fontSize: 10, color: "#64748b", marginBottom: 8 }}
        >
          CLUES
        </div>
        {round.clues.length === 0 && (
          <div className="font-sans italic" style={{ fontSize: 12, color: "#64748b" }}>
            (no clues yet)
          </div>
        )}
        {round.clues.map((c, i) => {
          const p = state.players.find((pp) => pp.id === c.playerId);
          return (
            <div
              key={i}
              className="animate-fade-in flex items-center gap-3"
              style={{
                background: "#1e1e2e",
                borderRadius: 8,
                padding: "8px 14px",
                marginBottom: 5,
                border: "1px solid rgba(51,65,85,0.2)",
              }}
            >
              <span style={{ fontSize: 18 }}>{p?.emoji}</span>
              <span className="font-sans" style={{ fontSize: 13, color: "#64748b", minWidth: 70 }}>
                {p?.name}
              </span>
              <span
                className="font-mono uppercase"
                style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0", letterSpacing: 2 }}
              >
                {c.word}
              </span>
            </div>
          );
        })}
      </div>

      {/* Input area */}
      {isYourTurn ? (
        <form onSubmit={submit} className="flex gap-2">
          <input
            autoFocus
            value={clue}
            onChange={(e) => setClue(e.target.value.replace(/\s+/g, ""))}
            placeholder="one-word clue"
            maxLength={24}
            className="flex-1 font-mono uppercase outline-none"
            style={{
              background: "#1e1e2e",
              border: "1.5px solid #f472b6",
              color: "#e2e8f0",
              borderRadius: 10,
              padding: "12px 16px",
              fontSize: 16,
              letterSpacing: 2,
            }}
          />
          <PrimaryButton type="submit" variant="primary" disabled={clue.trim().length === 0}>
            SEND
          </PrimaryButton>
        </form>
      ) : (
        <div
          className="font-sans italic text-center"
          style={{ fontSize: 13, color: "#64748b", padding: "8px 0" }}
        >
          {currentPlayer ? `Waiting on ${currentPlayer.emoji} ${currentPlayer.name}…` : "…"}
        </div>
      )}
    </div>
  );
}

function DiscussPhase({
  round,
  state,
  isHost,
  send,
}: {
  round: NonNullable<PublicState["round"]>;
  state: PublicState;
  isHost: boolean;
  send: (msg: ClientMessage) => void;
}) {
  return (
    <div className="mx-auto" style={{ maxWidth: 420 }}>
      <div
        className="text-center font-sans"
        style={{
          fontSize: 14,
          color: "#e2e8f0",
          marginBottom: 12,
        }}
      >
        Talk it out on Zoom. Who sounds suspicious?
      </div>
      <div style={{ marginBottom: 12 }}>
        <div
          className="font-mono uppercase tracking-widest"
          style={{ fontSize: 10, color: "#64748b", marginBottom: 8 }}
        >
          ALL CLUES
        </div>
        {round.clues.map((c, i) => {
          const p = state.players.find((pp) => pp.id === c.playerId);
          return (
            <div
              key={i}
              className="flex items-center gap-3"
              style={{
                background: "#1e1e2e",
                borderRadius: 8,
                padding: "8px 14px",
                marginBottom: 5,
                border: "1px solid rgba(51,65,85,0.2)",
              }}
            >
              <span style={{ fontSize: 18 }}>{p?.emoji}</span>
              <span className="font-sans" style={{ fontSize: 13, color: "#64748b", minWidth: 70 }}>
                {p?.name}
              </span>
              <span
                className="font-mono uppercase"
                style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0", letterSpacing: 2 }}
              >
                {c.word}
              </span>
            </div>
          );
        })}
      </div>
      {isHost && (
        <div className="flex justify-center gap-2" style={{ marginTop: 16 }}>
          <PrimaryButton variant="ghost" size="sm" onClick={() => send({ type: "extend-timer", seconds: 30 })}>
            +30s
          </PrimaryButton>
          <PrimaryButton variant="primary" size="sm" onClick={() => send({ type: "advance-phase" })}>
            START VOTE NOW
          </PrimaryButton>
        </div>
      )}
    </div>
  );
}

function VotePhase({
  round,
  state,
  send,
}: {
  round: NonNullable<PublicState["round"]>;
  state: PublicState;
  send: (msg: ClientMessage) => void;
}) {
  const yourVote = round.yourVoteTargetId;
  const votableLikely = state.players.filter((p) => p.id !== state.yourPlayerId);

  return (
    <div className="mx-auto" style={{ maxWidth: 400 }}>
      <div
        className="text-center font-sans"
        style={{ fontSize: 15, color: "#e2e8f0", marginBottom: 16 }}
      >
        Who is <span style={{ color: "#fbbf24", fontWeight: 700 }}>The Suspect</span>?
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {votableLikely.map((p) => {
          const selected = yourVote === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => send({ type: "submit-vote", targetPlayerId: p.id })}
              className="transition-all"
              style={{
                background: selected ? "rgba(244,114,182,0.18)" : "#1e1e2e",
                border: `2px solid ${selected ? "#f472b6" : "rgba(51,65,85,0.3)"}`,
                borderRadius: 12,
                padding: "14px 10px",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 6 }}>{p.emoji}</div>
              <div className="font-sans" style={{ fontSize: 14, color: "#e2e8f0", fontWeight: 500 }}>
                {p.name}
              </div>
              {selected && (
                <div
                  className="font-mono uppercase"
                  style={{ fontSize: 10, color: "#f472b6", marginTop: 4, letterSpacing: 1.5 }}
                >
                  ✓ VOTED
                </div>
              )}
            </button>
          );
        })}
      </div>
      <div
        className="text-center font-mono"
        style={{ fontSize: 11, color: "#64748b", marginTop: 14, letterSpacing: 1 }}
      >
        {round.votes.length}/{state.players.length} VOTED
      </div>
    </div>
  );
}

function SuspectGuessPhase({
  round,
  send,
}: {
  round: NonNullable<PublicState["round"]>;
  send: (msg: ClientMessage) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  if (!round.isYouSuspect) {
    return (
      <div
        className="text-center font-sans italic"
        style={{ fontSize: 14, color: "#64748b" }}
      >
        Suspect is choosing the word… 🎭
      </div>
    );
  }
  return (
    <div className="mx-auto" style={{ maxWidth: 420 }}>
      <div
        className="text-center font-mono uppercase tracking-widest"
        style={{ fontSize: 12, color: "#fbbf24", marginBottom: 12 }}
      >
        LAST CHANCE — PICK THE TARGET WORD
      </div>
      <WordGrid
        words={round.words}
        selected={selected}
        interactive
        onSelect={setSelected}
      />
      {selected && (
        <div className="text-center" style={{ marginTop: 14 }}>
          <PrimaryButton
            variant="primary"
            size="md"
            onClick={() => send({ type: "submit-suspect-guess", word: selected })}
          >
            LOCK IN {selected}
          </PrimaryButton>
        </div>
      )}
    </div>
  );
}

function ResolutionPhase({
  round,
  state,
  isHost,
  send,
}: {
  round: NonNullable<PublicState["round"]>;
  state: PublicState;
  isHost: boolean;
  send: (msg: ClientMessage) => void;
}) {
  const r = round.resolution;
  if (!r) return null;
  const lastRound = state.currentRoundNumber >= state.totalRounds;

  return (
    <div className="mx-auto text-center" style={{ maxWidth: 460 }}>
      <div
        className="font-mono uppercase tracking-widest"
        style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}
      >
        THE SUSPECT WAS
      </div>
      <div style={{ fontSize: 44, marginBottom: 2 }}>{r.suspectEmoji}</div>
      <div
        className="font-mono font-bold"
        style={{ fontSize: 30, color: "#fbbf24", letterSpacing: 4, marginBottom: 4 }}
      >
        {r.suspectName}
      </div>
      <div
        className="font-sans"
        style={{ fontSize: 14, color: r.caught ? "#4ade80" : "#ef4444", marginBottom: 20 }}
      >
        {r.caught
          ? `Caught! ${r.voteCounts[r.suspectId] ?? 0} vote${(r.voteCounts[r.suspectId] ?? 0) === 1 ? "" : "s"}.`
          : "Escaped! Wrong majority or tie."}
      </div>

      {r.caught && (
        <div
          className="font-sans"
          style={{
            background: r.guessCorrect ? "rgba(74,222,128,0.10)" : "rgba(239,68,68,0.10)",
            border: `1px solid ${r.guessCorrect ? "rgba(74,222,128,0.30)" : "rgba(239,68,68,0.30)"}`,
            borderRadius: 12,
            padding: "12px 16px",
            marginBottom: 16,
            fontSize: 14,
            color: r.guessCorrect ? "#4ade80" : "#ef4444",
          }}
        >
          {r.guessCorrect ? (
            <>
              🎉 But guessed <strong style={{ letterSpacing: 2 }}>{r.suspectGuess}</strong> correctly!
              Suspect steals the round.
            </>
          ) : r.suspectGuess ? (
            <>
              Guessed <strong style={{ letterSpacing: 2 }}>{r.suspectGuess}</strong>. The word was{" "}
              <strong style={{ letterSpacing: 2, color: "#e2e8f0" }}>{r.targetWord}</strong>.
            </>
          ) : (
            <>
              Didn't guess in time. The word was{" "}
              <strong style={{ letterSpacing: 2, color: "#e2e8f0" }}>{r.targetWord}</strong>.
            </>
          )}
        </div>
      )}

      {!r.caught && (
        <div
          className="font-sans"
          style={{ fontSize: 14, color: "#e2e8f0", marginBottom: 16 }}
        >
          The word was{" "}
          <strong style={{ letterSpacing: 2, color: "#fbbf24" }}>{r.targetWord}</strong>
        </div>
      )}

      {/* Score changes */}
      <div className="mx-auto text-left" style={{ maxWidth: 380, marginBottom: 16 }}>
        <div
          className="font-mono uppercase tracking-widest text-center"
          style={{ fontSize: 10, color: "#64748b", marginBottom: 8 }}
        >
          SCORE CHANGES
        </div>
        {r.deltas.length === 0 && (
          <div className="text-center font-sans italic" style={{ fontSize: 12, color: "#64748b" }}>
            No score changes this round.
          </div>
        )}
        {r.deltas.map((d, i) => {
          const p = state.players.find((pp) => pp.id === d.playerId);
          return (
            <div
              key={i}
              className="flex items-center gap-3"
              style={{
                background: "#1e1e2e",
                borderRadius: 8,
                padding: "8px 14px",
                marginBottom: 5,
                border: "1px solid rgba(51,65,85,0.2)",
              }}
            >
              <span style={{ fontSize: 18 }}>{p?.emoji}</span>
              <span className="font-sans" style={{ fontSize: 13, color: "#e2e8f0", flex: 1 }}>
                {p?.name}{" "}
                <span style={{ color: "#64748b", fontSize: 11 }}>· {d.reason}</span>
              </span>
              <span
                className="font-mono font-bold"
                style={{ fontSize: 15, color: d.delta > 0 ? "#4ade80" : "#ef4444" }}
              >
                {d.delta > 0 ? "+" : ""}
                {d.delta}
              </span>
            </div>
          );
        })}
      </div>

      {isHost && (
        <PrimaryButton variant="primary" size="lg" onClick={() => send({ type: "next-round" })}>
          {lastRound ? "FINISH GAME" : "NEXT ROUND"}
        </PrimaryButton>
      )}
      {!isHost && (
        <div className="font-sans italic" style={{ color: "#64748b", fontSize: 13 }}>
          Waiting for host…
        </div>
      )}
    </div>
  );
}

function FinishedPhase({
  state,
  isHost,
  send,
}: {
  state: PublicState;
  isHost: boolean;
  send: (msg: ClientMessage) => void;
}) {
  const sorted = [...state.players].sort((a, b) => b.score - a.score);
  return (
    <div className="mx-auto" style={{ maxWidth: 400 }}>
      <div className="text-center" style={{ marginBottom: 16 }}>
        <div
          className="font-mono uppercase tracking-widest"
          style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}
        >
          FINAL SCORES
        </div>
        <div
          className="font-mono font-bold text-glow-amber"
          style={{ fontSize: 28, color: "#e2e8f0", letterSpacing: 6 }}
        >
          SCOREBOARD
        </div>
      </div>
      {sorted.map((p, i) => (
        <div
          key={p.id}
          className="flex items-center gap-3"
          style={{
            background: i === 0 ? "rgba(251,191,36,0.10)" : "#1e1e2e",
            border: `1.5px solid ${i === 0 ? "rgba(251,191,36,0.30)" : "rgba(51,65,85,0.18)"}`,
            borderRadius: 10,
            padding: "12px 16px",
            marginBottom: 6,
          }}
        >
          <span
            className="font-mono font-bold"
            style={{
              fontSize: 18,
              color: i === 0 ? "#fbbf24" : i === 1 ? "#e2e8f0" : "#64748b",
              minWidth: 28,
            }}
          >
            #{i + 1}
          </span>
          <span style={{ fontSize: 22 }}>{p.emoji}</span>
          <span className="font-sans" style={{ fontSize: 15, color: "#e2e8f0", flex: 1, fontWeight: 500 }}>
            {p.name}
          </span>
          <span
            className="font-mono font-bold"
            style={{ fontSize: 22, color: i === 0 ? "#fbbf24" : "#e2e8f0" }}
          >
            {p.score}
          </span>
        </div>
      ))}
      {isHost && (
        <div className="text-center" style={{ marginTop: 18 }}>
          <PrimaryButton variant="ghost" size="md" onClick={() => send({ type: "reset-game" })}>
            PLAY AGAIN
          </PrimaryButton>
        </div>
      )}
    </div>
  );
}
