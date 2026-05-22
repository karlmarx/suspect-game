import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TokenBucket } from "../../worker/tokenBucket";

describe("TokenBucket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to capacity tokens immediately", () => {
    const b = new TokenBucket(5, 1);
    for (let i = 0; i < 5; i++) {
      expect(b.tryConsume()).toBe(true);
    }
    expect(b.tryConsume()).toBe(false);
  });

  it("refills at the configured rate", () => {
    const b = new TokenBucket(5, 2); // 2 tokens/sec
    for (let i = 0; i < 5; i++) b.tryConsume();
    expect(b.tryConsume()).toBe(false);
    vi.advanceTimersByTime(1000); // +1 sec = +2 tokens
    expect(b.tryConsume()).toBe(true);
    expect(b.tryConsume()).toBe(true);
    expect(b.tryConsume()).toBe(false);
  });

  it("clamps refill at capacity", () => {
    const b = new TokenBucket(3, 10);
    b.tryConsume();
    b.tryConsume();
    vi.advanceTimersByTime(10_000); // refill would be 100 tokens
    // Capacity is 3, so only 3 available
    for (let i = 0; i < 3; i++) expect(b.tryConsume()).toBe(true);
    expect(b.tryConsume()).toBe(false);
  });

  it("supports variable token costs", () => {
    const b = new TokenBucket(10, 1);
    expect(b.tryConsume(7)).toBe(true);
    expect(b.tryConsume(3)).toBe(true);
    expect(b.tryConsume(1)).toBe(false);
  });

  it("supports fractional refill across sub-second gaps", () => {
    const b = new TokenBucket(5, 10); // 10/sec = 1 per 100ms
    for (let i = 0; i < 5; i++) b.tryConsume();
    vi.advanceTimersByTime(150); // 1.5 tokens
    expect(b.tryConsume()).toBe(true);
    expect(b.tryConsume()).toBe(false); // only 0.5 left
  });

  it("sustained-rate scenario: 10/sec refill survives a 1/sec stream forever", () => {
    const b = new TokenBucket(20, 10);
    for (let i = 0; i < 200; i++) {
      vi.advanceTimersByTime(100);
      expect(b.tryConsume()).toBe(true);
    }
  });
});
