import type { Player } from "../shared/types";
import { Badge } from "./Badge";

interface PlayerCardProps {
  player: Player;
  showHost?: boolean;
  showYou?: boolean;
  yourId?: string;
  rightAccessory?: React.ReactNode;
}

export function PlayerCard({
  player,
  showHost = true,
  showYou = false,
  yourId,
  rightAccessory,
}: PlayerCardProps) {
  return (
    <div
      className="mb-1.5 flex items-center gap-3 rounded-[10px]"
      style={{
        background: "#1e1e2e",
        padding: "10px 16px",
        border: "1px solid rgba(51,65,85,0.18)",
        opacity: player.isConnected ? 1 : 0.55,
      }}
    >
      <span style={{ fontSize: 22 }}>{player.emoji}</span>
      <span className="font-sans" style={{ fontSize: 15, color: "#e2e8f0", fontWeight: 500 }}>
        {player.name}
        {showYou && yourId === player.id ? (
          <span className="ml-2 font-mono" style={{ color: "#64748b", fontSize: 11 }}>
            (you)
          </span>
        ) : null}
      </span>
      {showHost && player.isHost && <Badge color="amber">HOST</Badge>}
      {!player.isConnected && (
        <span className="font-mono uppercase tracking-widest" style={{ fontSize: 10, color: "#64748b" }}>
          AFK
        </span>
      )}
      {rightAccessory && <span className="ml-auto">{rightAccessory}</span>}
    </div>
  );
}
