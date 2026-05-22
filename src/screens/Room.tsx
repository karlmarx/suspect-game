import { useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { JoinForm } from "./JoinForm";
import { Lobby } from "./Lobby";
import { RoundView } from "./RoundView";
import { PageShell } from "../components/PageShell";
import { useGameRoom } from "../hooks/useGameRoom";
import { getOrCreateSessionId, loadProfile, saveProfile } from "../lib/session";
import { isValidRoomCode } from "../lib/roomCode";

export function Room() {
  const { code } = useParams<{ code: string }>();
  const upperCode = (code ?? "").toUpperCase();
  const sessionId = useMemo(() => getOrCreateSessionId(), []);
  const [profile, setProfile] = useState(() => loadProfile());
  const [locallyJoined, setLocallyJoined] = useState(false);

  const { state, connected, lastError, serverTimeOffsetMs, send, clearError } = useGameRoom({
    roomCode: upperCode,
    sessionId,
    autoJoin: locallyJoined && profile ? profile : undefined,
    enabled: isValidRoomCode(upperCode),
  });

  const isPlayerInRoom = state?.players.some((p) => p.id === sessionId) ?? false;
  const hasJoined = locallyJoined || isPlayerInRoom;

  if (!isValidRoomCode(upperCode)) {
    return <Navigate to="/" replace />;
  }

  const handleJoin = (name: string, emoji: string) => {
    const p = { name, emoji };
    saveProfile(p);
    setProfile(p);
    setLocallyJoined(true);
    send({ type: "join", name, emoji, sessionId });
  };

  // Connection states
  if (!connected) {
    return (
      <PageShell roomCode={upperCode}>
        <div className="px-5 py-10 text-center font-mono animate-pulse-soft" style={{ color: "#64748b" }}>
          Connecting…
        </div>
      </PageShell>
    );
  }

  if (!hasJoined) {
    return (
      <PageShell roomCode={upperCode}>
        <JoinForm
          roomCode={upperCode}
          initialName={profile?.name ?? ""}
          initialEmoji={profile?.emoji ?? "🎭"}
          onJoin={handleJoin}
          error={lastError}
        />
      </PageShell>
    );
  }

  if (!state) {
    return (
      <PageShell roomCode={upperCode}>
        <div className="px-5 py-10 text-center font-mono animate-pulse-soft" style={{ color: "#64748b" }}>
          Joining…
        </div>
      </PageShell>
    );
  }

  const isHost = state.hostId === state.yourPlayerId;

  return (
    <PageShell roomCode={state.roomCode}>
      {state.status === "lobby" && (
        <Lobby state={state} isHost={isHost} onStart={(r) => send({ type: "start-game", totalRounds: r })} />
      )}
      {(state.status === "playing" || state.status === "finished") && (
        <RoundView
          state={state}
          offsetMs={serverTimeOffsetMs}
          isHost={isHost}
          send={send}
          errorMessage={lastError}
          clearError={clearError}
        />
      )}
    </PageShell>
  );
}
