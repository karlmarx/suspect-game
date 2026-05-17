export type Phase =
  | "lobby"
  | "reveal"
  | "clue"
  | "discuss"
  | "vote"
  | "suspect-guess"
  | "resolution"
  | "finished";

export interface Player {
  id: string;
  name: string;
  emoji: string;
  score: number;
  isHost: boolean;
  isConnected: boolean;
}

export interface Clue {
  playerId: string;
  word: string;
}

export interface Vote {
  voterId: string;
  targetPlayerId: string;
}

export interface RoundDelta {
  playerId: string;
  delta: number;
  reason: string;
}

export interface Resolution {
  caught: boolean;
  suspectId: string;
  suspectName: string;
  suspectEmoji: string;
  targetWord: string;
  suspectGuess: string | null;
  guessCorrect: boolean | null;
  voteCounts: Record<string, number>;
  deltas: RoundDelta[];
}

export interface PublicRound {
  number: number;
  category: string;
  words: string[];
  /** Only present when caller is innocent. Suspects receive `null`. */
  targetWord: string | null;
  suspectId: string | null;
  isYouSuspect: boolean;
  clueOrder: string[];
  currentClueIndex: number;
  clues: Clue[];
  votes: { voterId: string; locked: boolean }[];
  yourVoteTargetId: string | null;
  phase: Phase;
  phaseEndsAt: number | null;
  resolution: Resolution | null;
}

export interface PublicState {
  roomCode: string;
  status: "lobby" | "playing" | "finished";
  hostId: string | null;
  yourPlayerId: string;
  players: Player[];
  totalRounds: number;
  currentRoundNumber: number;
  round: PublicRound | null;
  serverTime: number;
}

export type ClientMessage =
  | { type: "join"; name: string; emoji: string; sessionId: string }
  | { type: "rejoin"; sessionId: string }
  | { type: "start-game"; totalRounds: number }
  | { type: "submit-clue"; word: string }
  | { type: "submit-vote"; targetPlayerId: string }
  | { type: "submit-suspect-guess"; word: string }
  | { type: "advance-phase" }
  | { type: "next-round" }
  | { type: "reset-game" }
  | { type: "extend-timer"; seconds: number };

export type ServerMessage =
  | { type: "state"; state: PublicState }
  | { type: "error"; message: string }
  | { type: "you-are"; playerId: string };

export const PHASE_DURATIONS_MS: Record<Phase, number> = {
  lobby: 0,
  reveal: 5_000,
  clue: 30_000, // per-player; server resets when player submits
  discuss: 60_000,
  vote: 20_000,
  "suspect-guess": 30_000,
  resolution: 0,
  finished: 0,
};
