import { useState } from "react";
import { Glow } from "../components/Glow";
import { PlayerCard } from "../components/PlayerCard";
import { PrimaryButton } from "../components/PrimaryButton";
import type { PublicState } from "../shared/types";

interface LobbyProps {
  state: PublicState;
  isHost: boolean;
  onStart: (totalRounds: number) => void;
}

export function Lobby({ state, isHost, onStart }: LobbyProps) {
  const defaultRounds = Math.max(3, state.players.length * 2);
  const [rounds, setRounds] = useState(defaultRounds);
  const canStart = state.players.length >= 3;

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/room/${state.roomCode}` : "";

  return (
    <div className="relative px-5 py-6">
      <Glow color="#38bdf8" size={250} top={-60} right={-40} />

      <div className="text-center" style={{ marginBottom: 24 }}>
        <div
          className="font-mono uppercase tracking-[0.25em]"
          style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}
        >
          ROOM CODE
        </div>
        <div
          className="font-mono font-bold text-glow-pink"
          style={{ fontSize: 52, letterSpacing: 16, color: "#e2e8f0" }}
        >
          {state.roomCode}
        </div>
        <div className="font-sans" style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
          Share this code with your crew
        </div>
        {shareUrl && (
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(shareUrl)}
            className="font-mono"
            style={{
              fontSize: 10,
              color: "#38bdf8",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              marginTop: 6,
            }}
          >
            COPY INVITE LINK
          </button>
        )}
      </div>

      <div className="mx-auto" style={{ maxWidth: 360 }}>
        <div
          className="font-mono uppercase tracking-widest"
          style={{ fontSize: 10, color: "#64748b", marginBottom: 10 }}
        >
          PLAYERS ({state.players.length}/8)
        </div>
        {state.players.map((p) => (
          <PlayerCard key={p.id} player={p} showYou yourId={state.yourPlayerId} />
        ))}
      </div>

      {isHost && (
        <div className="mx-auto" style={{ maxWidth: 360, marginTop: 16 }}>
          <div
            className="font-mono uppercase tracking-widest"
            style={{ fontSize: 10, color: "#64748b", marginBottom: 8 }}
          >
            ROUNDS
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={3}
              max={20}
              value={rounds}
              onChange={(e) => setRounds(Number(e.target.value))}
              className="flex-1"
              style={{ accentColor: "#f472b6" }}
            />
            <span
              className="font-mono"
              style={{ fontSize: 22, fontWeight: 700, color: "#e2e8f0", minWidth: 32, textAlign: "right" }}
            >
              {rounds}
            </span>
          </div>
        </div>
      )}

      <div className="text-center" style={{ marginTop: 24 }}>
        {isHost ? (
          <PrimaryButton
            variant="success"
            size="lg"
            onClick={() => onStart(rounds)}
            disabled={!canStart}
          >
            {canStart ? "START GAME" : `NEED ${3 - state.players.length} MORE`}
          </PrimaryButton>
        ) : (
          <div className="font-sans italic" style={{ color: "#64748b", fontSize: 13 }}>
            Waiting for host to start…
          </div>
        )}
      </div>
    </div>
  );
}
