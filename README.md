# SUSPECT

> One word. One bluff. Who's faking it?

A real-time multiplayer word-bluffing game for happy hours. **3–8 players, ~3-minute rounds, Zoom-native.**

**Codenames meets The Chameleon** — everyone sees the same 4×4 word grid, one word is the target. One player (the Suspect) doesn't know which. Give one-word clues, vote on who's faking it.

---

## How to play

### Setup

1. One player clicks **CREATE ROOM** and shares the 4-letter code (or the URL `…/room/ABCD`) with the table.
2. Others click **JOIN ROOM**, type the code, pick a name + emoji.
3. Host clicks **START GAME**, picks number of rounds (default 5).

### A round, step by step

```
┌────────────┐   ┌──────────┐   ┌──────────┐   ┌────────┐   ┌──────────┐   ┌────────────┐
│   REVEAL   │ → │   CLUE   │ → │ DISCUSS  │ → │  VOTE  │ → │  GUESS   │ → │ RESOLUTION │
│   5s       │   │ 30s each │   │   60s    │   │  20s   │   │ (if      │   │            │
│            │   │          │   │          │   │        │   │  caught) │   │            │
└────────────┘   └──────────┘   └──────────┘   └────────┘   └──────────┘   └────────────┘
   See grid       One word        Talk it       Pick who's    Suspect       Scores +
   + target       per player,     out — no      faking it     guesses       reveal
   (innocents     in order        screen-       (can't vote   the target    Suspect
   only — the                     sharing       yourself)     word from
   Suspect sees                   restrictions               the grid
   "you are the                                              for the
   SUSPECT")                                                 steal
```

| Phase | What happens |
|---|---|
| **Reveal** | Innocents see the 4×4 grid with the target word highlighted. The Suspect sees the same grid with no highlight and a "YOU ARE THE SUSPECT" banner. |
| **Clue** | Players take turns (random order) giving a one-word clue. The clue must connect to the target word but not be one of the words on the grid. The Suspect has to bluff — they can hear other clues but don't know the target. |
| **Discuss** | 60 seconds of free Zoom discussion. Who sounds off? Whose clue was suspiciously generic? Host can extend the timer. |
| **Vote** | Each player picks who they think the Suspect is. Locked in once submitted. |
| **Guess** | If the Suspect was caught, they get **one chance** to guess the target word from the grid and steal the round. |
| **Resolution** | Reveal, scores, and a "NEXT ROUND" button for the host. |

### Scoring

| Outcome | Points |
|---|---|
| You voted correctly and the Suspect was caught | **+2** for each correct voter |
| Suspect caught but guesses the target word | **+2** Suspect, **0** everyone else |
| Suspect escapes (wrong majority or tie) | **+3** Suspect |
| Innocent player receives **zero** votes | **+1** bonus (you blended in) |

### Tips

- **Innocents:** clue something specific enough to signal you know, vague enough that the Suspect can't reverse-engineer it.
- **Suspects:** listen to early clues and echo their theme. Plurals and category words ("FRUIT", "RED") are dead giveaways.
- **Hosts:** use the **EXTEND TIMER** button if discussion is heating up.

---

## Stack

- **Frontend:** Vite + React 19 + TypeScript + Tailwind v4 — deployed on Vercel
- **Realtime backend:** PartyKit (Cloudflare Workers + Durable Objects) — one DO per room
- **Routing:** React Router 7 with `/room/:code` URLs
- **Shared:** `src/shared/types.ts` + `src/shared/words.ts` imported by both client and server
- **E2E:** Playwright multiplayer tests run in GitHub Actions

## Develop

```bash
cp .env.example .env       # optional: set VITE_APP_PASSWORD for the gate
npm install
npm run dev:all            # vite (5173) + partykit (1999) concurrently
```

Open `http://localhost:5173` in 3+ browser windows. Use incognito tabs or separate Chrome profiles so the windows don't share `localStorage` (sessions are keyed there).

## Test

```bash
npm run test:e2e           # Playwright multiplayer e2e
npm run test:e2e -- --ui   # interactive mode
```

The test boots `dev:all`, opens 3 browser contexts, and plays one full round end-to-end.

## Deploy

```bash
# Backend
npm run deploy:party
partykit env push APP_PASSWORD   # paste the shared password (server-enforced)

# Frontend (Vercel)
vercel --prod
```

Set these in the Vercel project env (Production scope):

| Var | Value |
|---|---|
| `VITE_PARTYKIT_HOST` | `suspect-game.<your-partykit-handle>.partykit.dev` |
| `VITE_APP_PASSWORD` | The same string you pushed as `APP_PASSWORD` to PartyKit |

**Custom subdomain:** Vercel project → Settings → Domains → add e.g. `suspect.yourdomain.com`.

> **Auth model:** The password is validated by the PartyKit server before a join is accepted, *and* by the client gate as a UX nicety. Even if someone bypasses the client gate via devtools, the server rejects their WebSocket join.

## Structure

```
party/
  server.ts            # PartyKit Durable Object: state machine, scoring, timers, password check
src/
  shared/              # Types + word bank, imported by both client and server
    types.ts
    words.ts
  components/          # UI primitives (WordGrid, Badge, Timer, PasswordGate, …)
  screens/             # Top-level views (Landing, Lobby, RoundView, …)
  hooks/               # useGameRoom (PartySocket wrapper), useCountdown
  lib/                 # session, roomCode, partyHost, password helpers
tests/e2e/             # Playwright tests
.github/workflows/     # CI
```

## Anti-cheat & privacy

- The Suspect never receives the target word over the wire — only confirmed innocent players do.
- Unidentified sockets (no successful join) get `targetWord: null` and `suspectId: null`.
- The shared password is enforced server-side; an unauthed socket cannot join a room.
