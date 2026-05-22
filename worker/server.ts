import { Server, type Connection, type ConnectionContext } from "partyserver";
import { TokenBucket } from "./tokenBucket";
import { generateGrid, pickCategory } from "../src/shared/words";

/** Max bytes a single WebSocket message may carry. Legitimate messages are
 *  <500 bytes; anything larger is either bugged client or abuse. */
const MAX_MESSAGE_BYTES = 4096;

/** Per-connection token bucket: capacity 20, refill 10/sec. Real gameplay
 *  is well under 2 msg/sec; this allows reasonable bursts (e.g. submitting
 *  a clue then immediately seeing the next phase) but kills sustained spam. */
const PER_CONN_BUCKET_CAPACITY = 20;
const PER_CONN_BUCKET_REFILL_PER_SEC = 10;

/** Max concurrent WebSocket connections per room. The player cap is 8, but
 *  unauth observers can also hold sockets open between join and game-state
 *  arrival; allow ~2x headroom for reconnect drift. */
const MAX_CONNECTIONS_PER_ROOM = 16;
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

export interface Env {
  Main: DurableObjectNamespace;
  IpLimiter: DurableObjectNamespace;
  APP_PASSWORD?: string;
}

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

export class GameServer extends Server<Env> {
  static options = { hibernate: true };

  state: RoomState = {
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

  /** Per-connection message rate-limit buckets. Map<connId, TokenBucket>.
   *  Buckets are in-memory only (lost on hibernation; re-created on first
   *  message from a re-hydrated connection — which is the correct semantic). */
  private readonly conn_buckets = new Map<string, TokenBucket>();

  async onStart() {
    const saved = await this.ctx.storage.get<SerializedRoomState>("state");
    if (saved) {
      this.state = deserialize(saved);
    }
  }

  async persist() {
    this.state.lastActivity = Date.now();
    await this.ctx.storage.put("state", serialize(this.state));
  }

  async onConnect(conn: Connection, ctx: ConnectionContext) {
    // Hard cap on total live sockets to this room — protects against an attacker
    // who knows a room code from opening N silent sockets.
    const live = [...this.getConnections()].length;
    if (live > MAX_CONNECTIONS_PER_ROOM) {
      conn.close(1013, "Room at connection capacity");
      return;
    }
    // Persist client IP on the connection state so onClose can release the
    // global per-IP slot in IpRateLimiter. Best-effort: in local dev there's
    // no CF header and we just skip the release call.
    const ip =
      ctx.request.headers.get("CF-Connecting-IP") ??
      ctx.request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
      "";
    if (ip) {
      try {
        conn.setState({ ip });
      } catch {
        // setState is a 2KB cap; an IP string is tiny so this should never throw.
      }
    }
    this.sendStateToOne(conn);
  }

  async onClose(conn: Connection) {
    // Release the global per-IP slot if one was reserved at connect time.
    const connState = (conn.state ?? {}) as { ip?: string };
    if (connState.ip) {
      try {
        const limiter = (this.env.IpLimiter as DurableObjectNamespace & {
          getByName(name: string): DurableObjectStub;
        }).getByName("global");
        await (limiter as unknown as { release(ip: string): Promise<void> }).release(connState.ip);
      } catch (err) {
        console.error("IpLimiter.release failed", err);
      }
    }
    this.conn_buckets.delete(conn.id);
    for (const [sessionId, connId] of this.state.connectionsBySession) {
      if (connId === conn.id) {
        const player = this.state.players.get(sessionId);
        if (player) player.isConnected = false;
        this.state.connectionsBySession.delete(sessionId);
        break;
      }
    }
    this.broadcastState();
    await this.persist();
  }

  async onMessage(conn: Connection, raw: string | ArrayBuffer) {
    // Message size guard — reject before any allocation/parse.
    const size = typeof raw === "string" ? raw.length : raw.byteLength;
    if (size > MAX_MESSAGE_BYTES) {
      this.sendError(conn, "Message too large");
      conn.close(1009, "Message too large");
      return;
    }

    // Per-connection token bucket — kills sustained message spam from a
    // single socket without affecting normal play.
    let bucket = this.conn_buckets.get(conn.id);
    if (!bucket) {
      bucket = new TokenBucket(PER_CONN_BUCKET_CAPACITY, PER_CONN_BUCKET_REFILL_PER_SEC);
      this.conn_buckets.set(conn.id, bucket);
    }
    if (!bucket.tryConsume(1)) {
      this.sendError(conn, "Rate limit exceeded");
      return;
    }

    const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
    let msg: ClientMessage;
    try {
      msg = JSON.parse(text);
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

  async onAlarm() {
    const round = this.state.round;
    if (!round) return;
    if (Date.now() < round.phaseEndsAt - 100) {
      await this.ctx.storage.setAlarm(round.phaseEndsAt);
      return;
    }
    await this.autoAdvancePhase();
  }

  // ---------- Handlers ----------

  private sessionFromConn(conn: Connection): string | null {
    for (const [sessionId, connId] of this.state.connectionsBySession) {
      if (connId === conn.id) return sessionId;
    }
    return null;
  }

  private checkPassword(provided: string | undefined): boolean {
    const expected = this.env.APP_PASSWORD ?? "";
    if (!expected) return true;
    return provided === expected;
  }

  private async handleJoin(
    msg: Extract<ClientMessage, { type: "join" }>,
    conn: Connection,
  ) {
    if (!this.checkPassword(msg.password)) {
      this.sendError(conn, "Incorrect password");
      return;
    }
    if (this.state.status !== "lobby") {
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
    const lower = msg.name.trim().toLowerCase();
    for (const p of this.state.players.values()) {
      if (p.name.toLowerCase() === lower && p.id !== msg.sessionId) {
        this.sendError(conn, "Name already taken in this room");
        return;
      }
    }
    const existing = this.state.players.get(msg.sessionId);
    if (existing) {
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
    conn: Connection,
  ) {
    if (!this.checkPassword(msg.password)) {
      this.sendError(conn, "Incorrect password");
      return;
    }
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
    conn: Connection,
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
    await this.ctx.storage.setAlarm(phaseEndsAt);
    this.broadcastState();
    await this.persist();
  }

  private async handleSubmitClue(
    msg: Extract<ClientMessage, { type: "submit-clue" }>,
    conn: Connection,
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
      round.phaseEndsAt = Date.now() + PHASE_DURATIONS_MS.clue;
      await this.ctx.storage.setAlarm(round.phaseEndsAt);
      this.broadcastState();
    }
    await this.persist();
  }

  private async handleSubmitVote(
    msg: Extract<ClientMessage, { type: "submit-vote" }>,
    conn: Connection,
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
    conn: Connection,
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

  private async handleAdvancePhase(conn: Connection) {
    const sessionId = this.sessionFromConn(conn);
    if (sessionId !== this.state.hostId) {
      this.sendError(conn, "Only host can advance phase");
      return;
    }
    await this.autoAdvancePhase();
  }

  private async handleNextRound(conn: Connection) {
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
      await this.ctx.storage.deleteAlarm();
      this.broadcastState();
      await this.persist();
      return;
    }
    await this.beginNextRound();
  }

  private async handleResetGame(conn: Connection) {
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
    await this.ctx.storage.deleteAlarm();
    this.broadcastState();
    await this.persist();
  }

  private async handleExtendTimer(
    msg: Extract<ClientMessage, { type: "extend-timer" }>,
    conn: Connection,
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
    await this.ctx.storage.setAlarm(round.phaseEndsAt);
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
        const expected = round.clueOrder[round.currentClueIndex];
        if (expected) {
          round.clues.push({ playerId: expected, word: "(no clue)" });
          round.currentClueIndex += 1;
        }
        if (round.currentClueIndex >= round.clueOrder.length) {
          await this.transitionPhase("discuss");
        } else {
          round.phaseEndsAt = Date.now() + PHASE_DURATIONS_MS.clue;
          await this.ctx.storage.setAlarm(round.phaseEndsAt);
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
      await this.ctx.storage.setAlarm(round.phaseEndsAt);
    } else {
      await this.ctx.storage.deleteAlarm();
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
      this.applyScore(round.suspectId, SCORE_SUSPECT_STEAL, "Suspect stole the round", deltas);
    } else if (caught && !guessCorrect) {
      for (const v of round.votes) {
        if (v.targetPlayerId === round.suspectId) {
          this.applyScore(v.voterId, SCORE_VOTE_CORRECT, "Voted correctly", deltas);
        }
      }
    } else {
      this.applyScore(round.suspectId, SCORE_SUSPECT_ESCAPE, "Suspect escaped", deltas);
    }

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
    await this.ctx.storage.deleteAlarm();
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
      roomCode: (this.name || "").toUpperCase(),
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
      const conn = this.getConnection(connId);
      if (!conn) continue;
      const msg: ServerMessage = { type: "state", state: this.buildPublicState(sessionId) };
      conn.send(JSON.stringify(msg));
    }
  }

  private sendStateToOne(conn: Connection) {
    const sessionId = this.sessionFromConn(conn) ?? "";
    const msg: ServerMessage = { type: "state", state: this.buildPublicState(sessionId) };
    conn.send(JSON.stringify(msg));
  }

  private sendError(conn: Connection, message: string) {
    const msg: ServerMessage = { type: "error", message };
    conn.send(JSON.stringify(msg));
  }

  private sendErrorToAll(message: string) {
    const msg: ServerMessage = { type: "error", message };
    for (const connId of this.state.connectionsBySession.values()) {
      const conn = this.getConnection(connId);
      conn?.send(JSON.stringify(msg));
    }
  }

  private sendYouAre(conn: Connection, playerId: string) {
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
