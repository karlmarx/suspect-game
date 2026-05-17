import type * as Party from "partykit/server";
import { generateGrid, pickCategory } from "../src/shared/words";
import {
  PHASE_DURATIONS_MS,
  type ClientMessage,
  type Clue,
  type Phase,
  type Player,
  type PublicRound,
  type PublicState,
  type Resolution,
  type RoundDelta,
  type ServerMessage,
  type Vote,
} from "../src/shared/types";

interface InternalRound {
  number: number;
  category: string;
  words: string[];
  targetWord: string;
  suspectId: string;
  clueOrder: string[];
  currentClueIndex: number;
  clues: Clue[];
  votes: Vote[];
  suspectGuess: string | null;
  phase: Phase;
  phaseEndsAt: number;
  resolution: Resolution | null;
}

interface RoomState {
  status: "lobby" | "playing" | "finished";
  hostId: string | null;
  /** sessionId -> Player */
  players: Map<string, Player>;
  /** join order; used for host transfer */
  joinOrder: string[];
  totalRounds: number;
  currentRoundNumber: number;
  round: InternalRound | null;
  /** sessionId -> connectionId (current live socket) */
  connectionsBySession: Map<string, string>;
  lastActivity: number;
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const SCORE_VOTE_CORRECT = 2;
const SCORE_SUSPECT_STEAL = 2;
const SCORE_SUSPECT_ESCAPE = 3;
const SCORE_INNOCENT_BONUS = 1;

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickSuspect(players: Player[]): string {
  return players[Math.floor(Math.random() * players.length)].id;
}

function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Name cannot be empty";
  if (trimmed.length > 16) return "Name must be 16 characters or less";
  return null;
}

function validateClue(word: string, gridWords: string[]): string | null {
  const trimmed = word.trim();
  if (!trimmed) return "Clue cannot be empty";
  if (/\s/.test(trimmed)) return "Clue must be a single word";
  if (trimmed.length > 24) return "Clue too long";
  const upper = trimmed.toUpperCase();
  if (gridWords.some((w) => w.toUpperCase() === upper)) {
    return "Clue cannot be a word on the grid";
  }
  return null;
}

export default class Server implements Party.Server {
  readonly room: Party.Room;
  state: RoomState;
  /** Cached room code. `this.room.id` is not accessible during alarm callbacks,
   *  so we save it to storage on connect and reload it in onStart. */
  private roomCode: string = "";

  constructor(room: Party.Room) {
    this.room = room;
    this.state = {
      status: "lobby",
      hostId: null,
      players: new Map(),
      joinOrder: [],
      totalRounds: 0,
      currentRoundNumber: 0,
      round: null,
      connectionsBySession: new Map(),
      lastActivity: Date.now(),
    };
  }

  async onStart() {
    // Reload state from durable storage (survives hibernation)
    const saved = await this.room.storage.get<SerializedRoomState>("state");
    if (saved) {
      this.state = deserialize(saved);
    }
    const code = await this.room.storage.get<string>("roomCode");
    if (code) this.roomCode = code;
  }

  async persist() {
    this.state.lastActivity = Date.now();
    await this.room.storage.put("state", serialize(this.state));
  }

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // Cache the room ID once — it is not accessible during alarm callbacks.
    if (!this.roomCode) {
      this.roomCode = this.room.id;
      await this.room.storage.put("roomCode", this.roomCode);
    }
    // Send room code immediately
    this.sendStateToOne(conn);
    void ctx; // unused
  }

  onClose(conn: Party.Connection) {
    // Find session by connectionId, mark player disconnected
    for (const [sessionId, connId] of this.state.connectionsBySession) {
      if (connId === conn.id) {
        const player = this.state.players.get(sessionId);
        if (player) {
          player.isConnected = false;
        }
        this.state.connectionsBySession.delete(sessionId);
        break;
      }
    }
    this.broadcastState();
    void this.persist();
  }

  async onMessage(raw: string, conn: Party.Connection) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      this.sendError(conn, "Invalid JSON");
      return;
    }

    try {
      switch (msg.type) {
        case "join":
          await this.handleJoin(msg, conn);
          break;
        case "rejoin":
          await this.handleRejoin(msg, conn);
          break;
        case "start-game":
          await this.handleStartGame(msg, conn);
          break;
        case "submit-clue":
          await this.handleSubmitClue(msg, conn);
          break;
        case "submit-vote":
          await this.handleSubmitVote(msg, conn);
          break;
        case "submit-suspect-guess":
          await this.handleSuspectGuess(msg, conn);
          break;
        case "advance-phase":
          await this.handleAdvancePhase(conn);
          break;
        case "next-round":
          await this.handleNextRound(conn);
          break;
        case "reset-game":
          await this.handleResetGame(conn);
          break;
        case "extend-timer":
          await this.handleExtendTimer(msg, conn);
          break;
        default: {
          const _exhaustive: never = msg;
          void _exhaustive;
          this.sendError(conn, "Unknown message type");
        }
      }
    } catch (err) {
      console.error("Error handling message:", err);
      this.sendError(conn, err instanceof Error ? err.message : "Server error");
    }
  }

  /** Cloudflare DO alarm fires here. Used for phase transitions. */
  async onAlarm() {
    const round = this.state.round;
    if (!round) return;
    if (Date.now() < round.phaseEndsAt - 100) {
      // Re-schedule if alarm fired too early
      await this.room.storage.setAlarm(round.phaseEndsAt);
      return;
    }
    await this.autoAdvancePhase();
  }

  // ---------- Handlers ----------

  private sessionFromConn(conn: Party.Connection): string | null {
    for (const [sessionId, connId] of this.state.connectionsBySession) {
      if (connId === conn.id) return sessionId;
    }
    return null;
  }

  private async handleJoin(
    msg: Extract<ClientMessage, { type: "join" }>,
    conn: Party.Connection,
  ) {
    if (this.state.status !== "lobby") {
      // Allow rejoin if the session was already a player
      if (this.state.players.has(msg.sessionId)) {
        return this.handleRejoin({ type: "rejoin", sessionId: msg.sessionId }, conn);
      }
      this.sendError(conn, "Game already in progress");
      return;
    }
    if (this.state.players.size >= 8) {
      this.sendError(conn, "Room is full (8 max)");
      return;
    }
    const nameErr = validateName(msg.name);
    if (nameErr) {
      this.sendError(conn, nameErr);
      return;
    }
    // Name uniqueness within room (case-insensitive)
    const lower = msg.name.trim().toLowerCase();
    for (const p of this.state.players.values()) {
      if (p.name.toLowerCase() === lower && p.id !== msg.sessionId) {
        this.sendError(conn, "Name already taken in this room");
        return;
      }
    }
    const existing = this.state.players.get(msg.sessionId);
    if (existing) {
      // Treat as rejoin under same session
      existing.isConnected = true;
      this.state.connectionsBySession.set(msg.sessionId, conn.id);
      this.sendYouAre(conn, msg.sessionId);
      this.broadcastState();
      return;
    }
    const isFirst = this.state.players.size === 0;
    const player: Player = {
      id: msg.sessionId,
      name: msg.name.trim(),
      emoji: msg.emoji || "🎲",
      score: 0,
      isHost: isFirst,
      isConnected: true,
    };
    this.state.players.set(msg.sessionId, player);
    this.state.joinOrder.push(msg.sessionId);
    this.state.connectionsBySession.set(msg.sessionId, conn.id);
    if (isFirst) this.state.hostId = msg.sessionId;
    this.sendYouAre(conn, msg.sessionId);
    this.broadcastState();
    await this.persist();
  }

  private async handleRejoin(
    msg: Extract<ClientMessage, { type: "rejoin" }>,
    conn: Party.Connection,
  ) {
    const player = this.state.players.get(msg.sessionId);
    if (!player) {
      this.sendError(conn, "Unknown session — please rejoin with name");
      return;
    }
    player.isConnected = true;
    this.state.connectionsBySession.set(msg.sessionId, conn.id);
    this.sendYouAre(conn, msg.sessionId);
    this.broadcastState();
    await this.persist();
  }

  private async handleStartGame(
    msg: Extract<ClientMessage, { type: "start-game" }>,
    conn: Party.Connection,
  ) {
    const sessionId = this.sessionFromConn(conn);
    if (sessionId !== this.state.hostId) {
      this.sendError(conn, "Only host can start the game");
      return;
    }
    if (this.state.players.size < 3) {
      this.sendError(conn, "Need at least 3 players");
      return;
    }
    const rounds = Math.max(1, Math.min(40, Math.floor(msg.totalRounds)));
    this.state.status = "playing";
    this.state.totalRounds = rounds;
    this.state.currentRoundNumber = 0;
    for (const p of this.state.players.values()) p.score = 0;
    await this.beginNextRound();
  }

  private async beginNextRound() {
    const players = [...this.state.players.values()];
    if (players.length < 3) {
      this.sendErrorToAll("Not enough players to continue");
      return;
    }
    this.state.currentRoundNumber += 1;
    const category = pickCategory();
    const { words, target } = generateGrid(category);
    const suspectId = pickSuspect(players);
    const clueOrder = shuffle(players.map((p) => p.id));

    const phaseEndsAt = Date.now() + PHASE_DURATIONS_MS.reveal;
    this.state.round = {
      number: this.state.currentRoundNumber,
      category: category.name,
      words,
      targetWord: target,
      suspectId,
      clueOrder,
      currentClueIndex: 0,
      clues: [],
      votes: [],
      suspectGuess: null,
      phase: "reveal",
      phaseEndsAt,
      resolution: null,
    };
    await this.room.storage.setAlarm(phaseEndsAt);
    this.broadcastState();
    await this.persist();
  }

  private async handleSubmitClue(
    msg: Extract<ClientMessage, { type: "submit-clue" }>,
    conn: Party.Connection,
  ) {
    const sessionId = this.sessionFromConn(conn);
    const round = this.state.round;
    if (!sessionId || !round) return;
    if (round.phase !== "clue") {
      this.sendError(conn, "Not the clue phase");
      return;
    }
    const expected = round.clueOrder[round.currentClueIndex];
    if (expected !== sessionId) {
      this.sendError(conn, "Wait your turn");
      return;
    }
    const err = validateClue(msg.word, round.words);
    if (err) {
      this.sendError(conn, err);
      return;
    }
    round.clues.push({ playerId: sessionId, word: msg.word.trim().toUpperCase() });
    round.currentClueIndex += 1;
    if (round.currentClueIndex >= round.clueOrder.length) {
      await this.transitionPhase("discuss");
    } else {
      // Reset 30s timer for next player
      round.phaseEndsAt = Date.now() + PHASE_DURATIONS_MS.clue;
      await this.room.storage.setAlarm(round.phaseEndsAt);
      this.broadcastState();
    }
    await this.persist();
  }

  private async handleSubmitVote(
    msg: Extract<ClientMessage, { type: "submit-vote" }>,
    conn: Party.Connection,
  ) {
    const sessionId = this.sessionFromConn(conn);
    const round = this.state.round;
    if (!sessionId || !round) return;
    if (round.phase !== "vote") {
      this.sendError(conn, "Not the vote phase");
      return;
    }
    if (msg.targetPlayerId === sessionId) {
      this.sendError(conn, "Cannot vote for yourself");
      return;
    }
    if (!this.state.players.has(msg.targetPlayerId)) {
      this.sendError(conn, "Unknown target");
      return;
    }
    const existing = round.votes.findIndex((v) => v.voterId === sessionId);
    if (existing >= 0) {
      round.votes[existing] = { voterId: sessionId, targetPlayerId: msg.targetPlayerId };
    } else {
      round.votes.push({ voterId: sessionId, targetPlayerId: msg.targetPlayerId });
    }
    const connectedVoters = [...this.state.players.values()].filter((p) => p.isConnected).length;
    if (round.votes.length >= connectedVoters) {
      await this.resolveVotes();
    } else {
      this.broadcastState();
    }
    await this.persist();
  }

  private async handleSuspectGuess(
    msg: Extract<ClientMessage, { type: "submit-suspect-guess" }>,
    conn: Party.Connection,
  ) {
    const sessionId = this.sessionFromConn(conn);
    const round = this.state.round;
    if (!sessionId || !round) return;
    if (round.phase !== "suspect-guess") {
      this.sendError(conn, "Not the suspect-guess phase");
      return;
    }
    if (sessionId !== round.suspectId) {
      this.sendError(conn, "Only the Suspect can guess");
      return;
    }
    const guessUpper = msg.word.trim().toUpperCase();
    if (!round.words.includes(guessUpper)) {
      this.sendError(conn, "Pick a word from the grid");
      return;
    }
    round.suspectGuess = guessUpper;
    await this.finalizeResolution(true);
  }

  private async handleAdvancePhase(conn: Party.Connection) {
    const sessionId = this.sessionFromConn(conn);
    if (sessionId !== this.state.hostId) {
      this.sendError(conn, "Only host can advance phase");
      return;
    }
    await this.autoAdvancePhase();
  }

  private async handleNextRound(conn: Party.Connection) {
    const sessionId = this.sessionFromConn(conn);
    if (sessionId !== this.state.hostId) {
      this.sendError(conn, "Only host can start next round");
      return;
    }
    if (this.state.round?.phase !== "resolution") {
      this.sendError(conn, "Not in resolution phase");
      return;
    }
    if (this.state.currentRoundNumber >= this.state.totalRounds) {
      this.state.status = "finished";
      if (this.state.round) this.state.round.phase = "finished";
      await this.room.storage.deleteAlarm();
      this.broadcastState();
      await this.persist();
      return;
    }
    await this.beginNextRound();
  }

  private async handleResetGame(conn: Party.Connection) {
    const sessionId = this.sessionFromConn(conn);
    if (sessionId !== this.state.hostId) {
      this.sendError(conn, "Only host can reset");
      return;
    }
    this.state.status = "lobby";
    this.state.round = null;
    this.state.currentRoundNumber = 0;
    this.state.totalRounds = 0;
    for (const p of this.state.players.values()) p.score = 0;
    await this.room.storage.deleteAlarm();
    this.broadcastState();
    await this.persist();
  }

  private async handleExtendTimer(
    msg: Extract<ClientMessage, { type: "extend-timer" }>,
    conn: Party.Connection,
  ) {
    const sessionId = this.sessionFromConn(conn);
    if (sessionId !== this.state.hostId) {
      this.sendError(conn, "Only host can extend timer");
      return;
    }
    const round = this.state.round;
    if (!round || round.phase !== "discuss") {
      this.sendError(conn, "Can only extend the discuss timer");
      return;
    }
    const seconds = Math.max(0, Math.min(120, Math.floor(msg.seconds)));
    round.phaseEndsAt += seconds * 1000;
    await this.room.storage.setAlarm(round.phaseEndsAt);
    this.broadcastState();
    await this.persist();
  }

  // ---------- Phase machine ----------

  private async autoAdvancePhase() {
    const round = this.state.round;
    if (!round) return;
    switch (round.phase) {
      case "reveal":
        await this.transitionPhase("clue");
        break;
      case "clue": {
        // Auto-skip current player's turn (record empty clue), then advance
        const expected = round.clueOrder[round.currentClueIndex];
        if (expected) {
          round.clues.push({ playerId: expected, word: "(no clue)" });
          round.currentClueIndex += 1;
        }
        if (round.currentClueIndex >= round.clueOrder.length) {
          await this.transitionPhase("discuss");
        } else {
          round.phaseEndsAt = Date.now() + PHASE_DURATIONS_MS.clue;
          await this.room.storage.setAlarm(round.phaseEndsAt);
          this.broadcastState();
          await this.persist();
        }
        break;
      }
      case "discuss":
        await this.transitionPhase("vote");
        break;
      case "vote":
        await this.resolveVotes();
        break;
      case "suspect-guess":
        await this.finalizeResolution(false);
        break;
      case "resolution":
      case "finished":
      case "lobby":
        break;
    }
  }

  private async transitionPhase(next: Phase) {
    const round = this.state.round;
    if (!round) return;
    round.phase = next;
    const dur = PHASE_DURATIONS_MS[next];
    round.phaseEndsAt = dur > 0 ? Date.now() + dur : 0;
    if (round.phaseEndsAt > 0) {
      await this.room.storage.setAlarm(round.phaseEndsAt);
    } else {
      await this.room.storage.deleteAlarm();
    }
    this.broadcastState();
    await this.persist();
  }

  private async resolveVotes() {
    const round = this.state.round;
    if (!round) return;
    const counts: Record<string, number> = {};
    for (const v of round.votes) {
      counts[v.targetPlayerId] = (counts[v.targetPlayerId] ?? 0) + 1;
    }
    let topId: string | null = null;
    let topCount = 0;
    let tie = false;
    for (const [id, c] of Object.entries(counts)) {
      if (c > topCount) {
        topCount = c;
        topId = id;
        tie = false;
      } else if (c === topCount && topCount > 0) {
        tie = true;
      }
    }
    const caught = !tie && topId === round.suspectId;
    if (caught) {
      // Suspect gets one chance to guess
      await this.transitionPhase("suspect-guess");
    } else {
      await this.finalizeResolution(false);
    }
  }

  private async finalizeResolution(fromSuspectGuess: boolean) {
    const round = this.state.round;
    if (!round) return;

    const counts: Record<string, number> = {};
    for (const v of round.votes) {
      counts[v.targetPlayerId] = (counts[v.targetPlayerId] ?? 0) + 1;
    }
    let topId: string | null = null;
    let topCount = 0;
    let tie = false;
    for (const [id, c] of Object.entries(counts)) {
      if (c > topCount) {
        topCount = c;
        topId = id;
        tie = false;
      } else if (c === topCount && topCount > 0) {
        tie = true;
      }
    }
    const caught = !tie && topId === round.suspectId;
    const guessCorrect = fromSuspectGuess
      ? round.suspectGuess === round.targetWord
      : caught
        ? false
        : null;

    const deltas: RoundDelta[] = [];

    if (caught && guessCorrect) {
      // Suspect steals
      this.applyScore(round.suspectId, SCORE_SUSPECT_STEAL, "Suspect stole the round", deltas);
    } else if (caught && !guessCorrect) {
      // Voters who correctly identified the suspect score
      for (const v of round.votes) {
        if (v.targetPlayerId === round.suspectId) {
          this.applyScore(v.voterId, SCORE_VOTE_CORRECT, "Voted correctly", deltas);
        }
      }
    } else {
      // Suspect escaped
      this.applyScore(round.suspectId, SCORE_SUSPECT_ESCAPE, "Suspect escaped", deltas);
    }

    // Innocent bonus: any non-Suspect player who got zero votes
    for (const p of this.state.players.values()) {
      if (p.id === round.suspectId) continue;
      if (!counts[p.id]) {
        this.applyScore(p.id, SCORE_INNOCENT_BONUS, "Blended in (no votes)", deltas);
      }
    }

    const suspect = this.state.players.get(round.suspectId);
    const resolution: Resolution = {
      caught,
      suspectId: round.suspectId,
      suspectName: suspect?.name ?? "?",
      suspectEmoji: suspect?.emoji ?? "🎭",
      targetWord: round.targetWord,
      suspectGuess: round.suspectGuess,
      guessCorrect,
      voteCounts: counts,
      deltas,
    };
    round.resolution = resolution;
    round.phase = "resolution";
    round.phaseEndsAt = 0;
    await this.room.storage.deleteAlarm();
    this.broadcastState();
    await this.persist();
  }

  private applyScore(playerId: string, delta: number, reason: string, deltas: RoundDelta[]) {
    const p = this.state.players.get(playerId);
    if (!p) return;
    p.score += delta;
    deltas.push({ playerId, delta, reason });
  }

  // ---------- Broadcasting ----------

  private buildPublicState(forSessionId: string): PublicState {
    const player = this.state.players.get(forSessionId);
    const players = [...this.state.players.values()];
    let publicRound: PublicRound | null = null;
    if (this.state.round) {
      const r = this.state.round;
      const isKnownPlayer = !!player;
      const isSuspect = isKnownPlayer && forSessionId === r.suspectId;
      const isInnocent = isKnownPlayer && !isSuspect;
      // Target word goes ONLY to confirmed innocent players.
      // Unidentified observers and the Suspect both see `null`.
      // Suspect is revealed only at resolution/finished.
      const revealSuspect = r.phase === "resolution" || r.phase === "finished";
      publicRound = {
        number: r.number,
        category: r.category,
        words: r.words,
        targetWord: isInnocent ? r.targetWord : null,
        suspectId: revealSuspect ? r.suspectId : null,
        isYouSuspect: isSuspect,
        clueOrder: r.clueOrder,
        currentClueIndex: r.currentClueIndex,
        clues: r.clues,
        votes: r.votes.map((v) => ({ voterId: v.voterId, locked: true })),
        yourVoteTargetId:
          r.phase === "vote" || r.phase === "suspect-guess" || r.phase === "resolution"
            ? r.votes.find((v) => v.voterId === forSessionId)?.targetPlayerId ?? null
            : null,
        phase: r.phase,
        phaseEndsAt: r.phaseEndsAt || null,
        resolution: r.resolution,
      };
    }
    return {
      roomCode: (this.roomCode || "").toUpperCase(),
      status: this.state.status,
      hostId: this.state.hostId,
      yourPlayerId: player?.id ?? forSessionId,
      players,
      totalRounds: this.state.totalRounds,
      currentRoundNumber: this.state.currentRoundNumber,
      round: publicRound,
      serverTime: Date.now(),
    };
  }

  private broadcastState() {
    for (const [sessionId, connId] of this.state.connectionsBySession) {
      const conn = this.room.getConnection(connId);
      if (!conn) continue;
      const msg: ServerMessage = { type: "state", state: this.buildPublicState(sessionId) };
      conn.send(JSON.stringify(msg));
    }
  }

  private sendStateToOne(conn: Party.Connection) {
    // For initial connect before the client has identified itself
    const sessionId = this.sessionFromConn(conn) ?? "";
    const msg: ServerMessage = { type: "state", state: this.buildPublicState(sessionId) };
    conn.send(JSON.stringify(msg));
  }

  private sendError(conn: Party.Connection, message: string) {
    const msg: ServerMessage = { type: "error", message };
    conn.send(JSON.stringify(msg));
  }

  private sendErrorToAll(message: string) {
    const msg: ServerMessage = { type: "error", message };
    for (const connId of this.state.connectionsBySession.values()) {
      const conn = this.room.getConnection(connId);
      conn?.send(JSON.stringify(msg));
    }
  }

  private sendYouAre(conn: Party.Connection, playerId: string) {
    const msg: ServerMessage = { type: "you-are", playerId };
    conn.send(JSON.stringify(msg));
  }
}

// ---------- Persistence helpers ----------

interface SerializedRoomState {
  status: RoomState["status"];
  hostId: string | null;
  players: [string, Player][];
  joinOrder: string[];
  totalRounds: number;
  currentRoundNumber: number;
  round: InternalRound | null;
  lastActivity: number;
}

function serialize(state: RoomState): SerializedRoomState {
  return {
    status: state.status,
    hostId: state.hostId,
    players: [...state.players.entries()].map(([k, v]) => [k, { ...v, isConnected: false }]),
    joinOrder: state.joinOrder,
    totalRounds: state.totalRounds,
    currentRoundNumber: state.currentRoundNumber,
    round: state.round,
    lastActivity: state.lastActivity,
  };
}

function deserialize(s: SerializedRoomState): RoomState {
  return {
    status: s.status,
    hostId: s.hostId,
    players: new Map(s.players),
    joinOrder: s.joinOrder,
    totalRounds: s.totalRounds,
    currentRoundNumber: s.currentRoundNumber,
    round: s.round,
    connectionsBySession: new Map(),
    lastActivity: s.lastActivity,
  };
}

void TWO_HOURS_MS; // (planned: cron-style sweep for expiry; PartyKit auto-hibernates idle rooms anyway)
