# SUSPECT

> One word. One bluff. Who's faking it?

A real-time multiplayer word bluffing game for happy hours. 3–8 players. ~3 minute rounds. Zoom-native.

**Codenames meets The Chameleon** — everyone sees the same 4×4 word grid, one word is the target. One player (the Suspect) doesn't know which. Give one-word clues, vote on who's faking it.

## Stack

- **Frontend:** Vite + React 19 + TypeScript + Tailwind v4 — deployed on Vercel
- **Realtime backend:** PartyKit (Cloudflare Workers + Durable Objects) — one DO per room
- **Routing:** React Router 7 with `/room/:code` URLs
- **Shared:** `src/shared/types.ts` + `src/shared/words.ts` imported by both client and server

## Develop

```bash
npm install
npm run dev:all  # vite (5173) + partykit (1999) concurrently
```

Open `http://localhost:5173` in 3+ browser windows (or incognito tabs / separate profiles to avoid sharing localStorage).

## Deploy

```bash
# Backend
npm run deploy:party   # → suspect-game.<your-partykit-handle>.partykit.dev

# Frontend (Vercel)
vercel --prod
```

Set these in the Vercel project env (Production):

- `VITE_PARTYKIT_HOST` — `suspect-game.<your-handle>.partykit.dev`
- `VITE_APP_PASSWORD` — shared password gate; leave unset to disable

To attach a subdomain, add it under Vercel project → Settings → Domains.

## Structure

```
party/
  server.ts            # PartyKit Durable Object: game state machine, scoring, timers
src/
  shared/              # Types + word bank, imported by both client and server
    types.ts
    words.ts
  components/          # Reusable UI primitives (WordGrid, Badge, Timer, ...)
  screens/             # Top-level views (Landing, Lobby, RoundView, ...)
  hooks/               # useGameRoom (PartySocket wrapper), useCountdown
  lib/                 # session, roomCode, partyHost helpers
```

## Anti-cheat

The Suspect never receives the target word over the wire — only confirmed innocent players do.
Unidentified observers connecting directly to the WebSocket get `targetWord: null` and `suspectId: null`.

## Scoring

| Outcome | Points |
|---|---|
| Voted correctly to catch the Suspect | +2 |
| Suspect caught but guesses target word | +2 (Suspect), 0 (everyone else) |
| Suspect escapes (wrong vote or tie) | +3 (Suspect) |
| Innocent receives zero votes | +1 bonus |
