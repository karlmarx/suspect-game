/**
 * Fair-rotation Suspect picker.
 *
 * The naive picker (uniform random over all players) lets statistical clumping
 * produce "same Suspect for many rounds in a row" — and the Workers DO
 * `Math.random()` empirically skews further from uniform than expected.
 *
 * This picker draws from only the players who have been Suspect the fewest
 * times so far, guaranteeing that after N rounds with K players nobody is
 * Suspect more than ⌈N/K⌉ times. We still use a crypto-secure source for the
 * final tiebreak within the pool, so the order *within* a min-count tier is
 * unpredictable.
 */

/** Crypto-secure float in [0, 1). Replaces Math.random for the final pick. */
export function secureRandom(): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] / 0x100000000;
}

/**
 * Pick the next Suspect from `playerIds`, biased toward players who have
 * been Suspect the fewest times so far.
 *
 * @param playerIds — the eligible players (typically every connected, joined player)
 * @param counts — sessionId → number of past Suspect rounds for that session
 * @param rng — optional injectable RNG (test seam); defaults to crypto-secure
 */
export function pickFairSuspect(
  playerIds: readonly string[],
  counts: ReadonlyMap<string, number>,
  rng: () => number = secureRandom,
): string {
  if (playerIds.length === 0) {
    throw new Error("pickFairSuspect called with no players");
  }
  let min = Infinity;
  for (const id of playerIds) {
    const c = counts.get(id) ?? 0;
    if (c < min) min = c;
  }
  const pool: string[] = [];
  for (const id of playerIds) {
    if ((counts.get(id) ?? 0) === min) pool.push(id);
  }
  // pool is guaranteed non-empty (min was found across playerIds)
  const idx = Math.floor(rng() * pool.length);
  // Defensive clamp in case rng() returns exactly 1.0 in some host.
  return pool[Math.min(idx, pool.length - 1)];
}
