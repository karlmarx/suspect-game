// Reproduce: "same person was the suspect each time"
// Connects N players to a fresh room, plays 10 rounds, reports who was suspect each round.

import PartySocketDefault from "partysocket";
const PartySocket = PartySocketDefault.default ?? PartySocketDefault;

const HOST = process.argv[2] ?? "suspect-game.karlmarx.partykit.dev";
const ROOM = "repro" + Math.random().toString(36).slice(2, 6);
const N_PLAYERS = 5;
const N_ROUNDS = 10;
const PASSWORD = process.env.APP_PASSWORD || "";

function makePlayer(name, emoji) {
  const sessionId = `sess-${name}-${Date.now()}-${Math.random()}`;
  const ws = new PartySocket({ host: HOST, room: ROOM });
  let state = null;
  ws.on = (type, fn) => ws.addEventListener(type, fn);
  return new Promise((resolve) => {
    const player = {
      name, emoji, sessionId, ws,
      get state() { return state; },
      get id() { return state?.yourPlayerId; },
      isHost() { return state?.hostId === this.id; },
      isYouSuspect() { return state?.round?.isYouSuspect; },
      phase() { return state?.round?.phase; },
      send(msg) { ws.send(JSON.stringify(msg)); },
    };
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "join", name, emoji, sessionId, password: PASSWORD }));
    });
    ws.addEventListener("message", (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "state") {
        state = msg.state;
        if (state.players.some((p) => p.id === sessionId)) resolve(player);
      }
    });
  });
}

const log = (...a) => console.log(...a);

const players = [];
for (let i = 0; i < N_PLAYERS; i++) {
  const p = await makePlayer(`P${i}`, "🎲");
  players.push(p);
  await new Promise((r) => setTimeout(r, 200)); // stagger so first joiner becomes host
}

const host = players.find((p) => p.isHost());
log(`Host: ${host.name}, all players: ${players.map((p) => `${p.name}(${p.id.slice(0,6)})`).join(", ")}`);

host.send({ type: "start-game", totalRounds: N_ROUNDS });

const suspectByRound = [];

// Helper: wait until a condition holds on any player's state
async function waitFor(predicate, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, 30));
  }
  return false;
}

for (let r = 1; r <= N_ROUNDS; r++) {
  // Wait for round to begin (any player in reveal/clue phase)
  await waitFor(() => players.some((p) => p.state?.round?.number === r && p.state.round.phase !== "lobby"));
  // Find who is suspect this round (the one with isYouSuspect=true)
  const suspect = players.find((p) => p.isYouSuspect());
  const suspectName = suspect?.name ?? "?";
  suspectByRound.push(suspectName);
  log(`Round ${r}: suspect = ${suspectName} (phase=${players[0].state?.round?.phase})`);

  // Force advance through phases as host until resolution
  while (!players.every((p) => p.state?.round?.phase === "resolution" || p.state?.round?.number > r)) {
    const phase = players[0].state?.round?.phase;
    if (phase === "clue") {
      // Auto-submit clue from whoever's turn it is
      const idx = players[0].state.round.currentClueIndex;
      const turn = players[0].state.round.clueOrder[idx];
      const me = players.find((p) => p.id === turn);
      if (me) me.send({ type: "submit-clue", word: `clue${r}` });
    } else {
      host.send({ type: "advance-phase" });
    }
    await new Promise((r) => setTimeout(r, 80));
  }

  // Advance to next round
  if (r < N_ROUNDS) host.send({ type: "next-round" });
  await new Promise((r) => setTimeout(r, 100));
}

log("");
log("=== Suspect distribution ===");
const counts = {};
for (const s of suspectByRound) counts[s] = (counts[s] ?? 0) + 1;
for (const [name, c] of Object.entries(counts)) {
  log(`  ${name}: ${c}/${N_ROUNDS}`);
}

for (const p of players) p.ws.close();
process.exit(0);
