import { describe, it, expect } from "vitest";
import { pickFairSuspect } from "../../worker/rotation";

// Deterministic LCG so tests are reproducible regardless of host RNG.
function makeRng(seed = 1): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe("pickFairSuspect", () => {
  it("picks every player exactly once when N == K", () => {
    const players = ["A", "B", "C", "D", "E"];
    const counts = new Map(players.map((p) => [p, 0]));
    const rng = makeRng();
    const seen = new Set<string>();

    for (let r = 0; r < players.length; r++) {
      const picked = pickFairSuspect(players, counts, rng);
      seen.add(picked);
      counts.set(picked, (counts.get(picked) ?? 0) + 1);
    }

    expect(seen.size).toBe(players.length);
  });

  it("gives every player the same count when N is a multiple of K", () => {
    const players = ["A", "B", "C", "D", "E"];
    const counts = new Map(players.map((p) => [p, 0]));
    const rng = makeRng(42);

    for (let r = 0; r < 10; r++) {
      const picked = pickFairSuspect(players, counts, rng);
      counts.set(picked, (counts.get(picked) ?? 0) + 1);
    }

    for (const p of players) {
      expect(counts.get(p)).toBe(2);
    }
  });

  it("keeps counts within ±1 across all players when N isn't divisible by K", () => {
    const players = ["A", "B", "C", "D"];
    const counts = new Map(players.map((p) => [p, 0]));
    const rng = makeRng(7);

    for (let r = 0; r < 5; r++) {
      const picked = pickFairSuspect(players, counts, rng);
      counts.set(picked, (counts.get(picked) ?? 0) + 1);
    }

    const values = [...counts.values()];
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
    expect(values.reduce((a, b) => a + b, 0)).toBe(5);
  });

  it("never picks the same player twice in a row when others have lower count", () => {
    const players = ["A", "B", "C"];
    const counts = new Map([["A", 1], ["B", 0], ["C", 0]]);
    // Even if RNG would pick index 0 of the full list, the pool should exclude A.
    const picked = pickFairSuspect(players, counts, () => 0);
    expect(picked).not.toBe("A");
  });

  it("prioritizes a newly-joined player whose count is zero", () => {
    const players = ["A", "B", "C"];
    const counts = new Map([["A", 3], ["B", 3], ["C", 0]]);
    const picked = pickFairSuspect(players, counts, () => 0.99);
    expect(picked).toBe("C");
  });

  it("treats missing-from-counts players as count 0", () => {
    const players = ["A", "B", "C"];
    const counts = new Map([["A", 2], ["B", 2]]); // C absent
    const picked = pickFairSuspect(players, counts, () => 0.5);
    expect(picked).toBe("C");
  });

  it("throws on empty player list", () => {
    expect(() => pickFairSuspect([], new Map(), () => 0)).toThrow();
  });

  it("survives stress: 1000 rounds × 5 players stays within ±1 of fair", () => {
    const players = ["A", "B", "C", "D", "E"];
    const counts = new Map(players.map((p) => [p, 0]));
    const rng = makeRng(12345);

    for (let r = 0; r < 1000; r++) {
      const picked = pickFairSuspect(players, counts, rng);
      counts.set(picked, (counts.get(picked) ?? 0) + 1);
    }

    const values = [...counts.values()];
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
  });
});
