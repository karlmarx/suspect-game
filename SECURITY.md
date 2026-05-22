# Security & threat model

This is a happy-hour party game with no logins. It is **not** holding valuable
state — worst-case impact of compromise is "stranger joins your game" or
"the service is briefly unavailable." Defenses are sized accordingly.

Backend layout for context:
- Static SPA on Vercel (Vercel handles edge DDoS, TLS, cert renewal).
- Realtime backend = Durable Objects via partyserver, deployed on Cloudflare
  Workers (Cloudflare handles network-layer DDoS for free). *Currently the
  worker is unmerged-but-undeployed; legacy `*.partykit.dev` is serving and
  inherits the same protections since it runs on Cloudflare too.*

## Threats considered

| # | Threat | Impact | Defense |
|---|--------|--------|---------|
| T1 | Network-layer DDoS (SYN flood, UDP, etc.) | Service unreachable | Cloudflare's free-tier DDoS shield. Out of our control & sufficient. |
| T2 | L7 DDoS — flood of WebSocket opens from one source | Backend CPU exhaustion, legitimate users denied | `IpRateLimiter` DO: per-IP cap of **12 new conns/min** and **8 concurrent**. Returns 429 with `Retry-After`. |
| T3 | Sustained message spam on an open connection | DO CPU exhaustion, per-room slowdown | Per-connection **token bucket** (capacity 20, refill 10/sec). Sends `error` then drops further messages until bucket refills. |
| T4 | Oversized payload | DO memory pressure, parse cost | **4 KB hard cap** on incoming WS messages. Larger messages get rejected and the socket closed with code 1009. |
| T5 | Connection-storm on a single known room | Room state thrash, host can't reconnect | **16 concurrent connections / room cap** (8 players × 2x reconnect headroom). New sockets get a clean WS close (1013). |
| T6 | Room-code enumeration | Trolls find live games | Room codes are 4 chars from a 24-letter alphabet → 331,776 codes. Enumeration is possible but trolls gain only the ability to join an unauth'd game and pick a fake name. Out of scope for v1 — bumping to 5+ chars is the simple fix if it becomes a problem. |
| T7 | Cross-player data leak (Suspect learns the target word) | Game integrity broken | `buildPublicState()` filters per-recipient: only confirmed-innocent sessionIds get `targetWord`; Suspect and unauth observers see `null`. Tested in-band — see `tests/e2e/multiplayer.spec.ts`. |
| T8 | Impersonation / vote spoofing | Game integrity broken | All authoritative state (votes, clues, scores) lives server-side. Client messages carry no privileged fields; server resolves voter identity from `connectionsBySession`. |
| T9 | XSS via player name / clue | Account compromise | React escapes all interpolated text by default; no `dangerouslySetInnerHTML` anywhere. Name and clue are length-capped (16 / 24 chars) and clue is regex-validated. |
| T10 | Replay / tampering of server messages | Game state corruption | WSS only (TLS by default at the edge). All state derives from server; client just renders. |

## Intentional non-defenses

These are *known gaps* that we've decided not to fix for v1:

1. **No auth / no password gate.** `VITE_APP_PASSWORD` and `APP_PASSWORD`
   are unset; anyone with a room code can join. Server-side password code
   exists in `worker/server.ts` (`checkPassword`) and is wired but inert
   when no password is configured. To re-enable: see the README "Deploy"
   section.

2. **No CAPTCHA on room creation.** Would kill the "just send the URL"
   UX. Acceptable as long as T2's rate limit holds.

3. **No profanity filter on player names.** Karl plays with friends; if a
   coworker picks something crude that's a social problem, not a
   technical one.

4. **No idle-room TTL.** Rooms hibernate when idle (CF handles this) so
   storage cost is negligible. A "rooms older than 24h auto-purge" sweep
   would be tidy but isn't load-bearing.

5. **`Math.random()` for game randomness** (suspect selection, grid
   shuffle, clue order). Predictable in theory, but predicting it
   requires reading the DO's clock and isn't a meaningful threat for a
   party game.

## Deployment notes for the defenses above

T2 and the connection-storm rejection in T5 only activate **after the
partyserver migration ships** (currently committed but not deployed —
needs `wrangler login` to push). On the legacy `*.partykit.dev` runtime
these protections are absent; Cloudflare's network-layer shield is the
only barrier. The window of exposure is bounded because the legacy code
is also unmodifiable by us (PartyKit deprecation — see
`~/karl-infra/infra/suspect-game.md`).

## Reporting

Found something? Email k@93.fyi or open a private security advisory on
the GitHub repo.
