import { useCallback, useEffect, useRef, useState } from "react";
import PartySocket from "partysocket";
import type {
  ClientMessage,
  PublicState,
  ServerMessage,
} from "../shared/types";
import { getPartyHost } from "../lib/partyHost";
import { getStoredPassword } from "../lib/password";

export interface UseGameRoomOptions {
  roomCode: string;
  sessionId: string;
  /** Auto-join with this name/emoji when socket opens. */
  autoJoin?: { name: string; emoji: string };
  enabled?: boolean;
}

export interface UseGameRoomResult {
  state: PublicState | null;
  connected: boolean;
  lastError: string | null;
  /** offset = serverTime - clientTime, so render with Date.now() + offset */
  serverTimeOffsetMs: number;
  send: (msg: ClientMessage) => void;
  clearError: () => void;
}

export function useGameRoom({
  roomCode,
  sessionId,
  autoJoin,
  enabled = true,
}: UseGameRoomOptions): UseGameRoomResult {
  const [state, setState] = useState<PublicState | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const socketRef = useRef<PartySocket | null>(null);
  const autoJoinRef = useRef(autoJoin);
  useEffect(() => {
    autoJoinRef.current = autoJoin;
  });

  useEffect(() => {
    if (!enabled || !roomCode || !sessionId) return;
    const socket = new PartySocket({
      host: getPartyHost(),
      room: roomCode.toLowerCase(),
    });
    socketRef.current = socket;

    const handleOpen = () => {
      setConnected(true);
      // Always try rejoin first; server falls back to error on unknown session
      // and we then attempt a fresh join with name/emoji if provided.
      socket.send(
        JSON.stringify({
          type: "rejoin",
          sessionId,
          password: getStoredPassword(),
        } satisfies ClientMessage),
      );
    };

    const handleMessage = (event: MessageEvent) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data as string);
      } catch {
        return;
      }
      if (msg.type === "state") {
        setState(msg.state);
        setOffset(msg.state.serverTime - Date.now());
      } else if (msg.type === "error") {
        const isUnknownSession = msg.message.toLowerCase().includes("unknown session");
        // Unknown session error → fall back to a fresh join if we have a name
        if (isUnknownSession && autoJoinRef.current) {
          socket.send(
            JSON.stringify({
              type: "join",
              name: autoJoinRef.current.name,
              emoji: autoJoinRef.current.emoji,
              sessionId,
              password: getStoredPassword(),
            } satisfies ClientMessage),
          );
          return;
        }
        // Swallow the rejoin-failure entirely; the user just hasn't joined yet.
        if (isUnknownSession) return;
        setLastError(msg.message);
      }
    };

    const handleClose = () => setConnected(false);

    socket.addEventListener("open", handleOpen);
    socket.addEventListener("message", handleMessage);
    socket.addEventListener("close", handleClose);

    return () => {
      socket.removeEventListener("open", handleOpen);
      socket.removeEventListener("message", handleMessage);
      socket.removeEventListener("close", handleClose);
      socket.close();
      socketRef.current = null;
    };
  }, [enabled, roomCode, sessionId]);

  const send = useCallback((msg: ClientMessage) => {
    const sock = socketRef.current;
    if (!sock) return;
    sock.send(JSON.stringify(msg));
  }, []);

  const clearError = useCallback(() => setLastError(null), []);

  return { state, connected, lastError, serverTimeOffsetMs: offset, send, clearError };
}
