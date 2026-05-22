/**
 * Simple token bucket: capacity tokens, refill rate per second. Pure math
 * with no runtime dependencies so it can be unit-tested in plain Node.
 */
export class TokenBucket {
  private readonly capacity: number;
  private readonly refillPerSec: number;
  private tokens: number;
  private lastRefill: number;

  constructor(capacity: number, refillPerSec: number) {
    this.capacity = capacity;
    this.refillPerSec = refillPerSec;
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  /** Returns true if a token was consumed, false if bucket was empty. */
  tryConsume(cost = 1): boolean {
    const now = Date.now();
    const elapsedSec = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSec * this.refillPerSec);
    this.lastRefill = now;
    if (this.tokens < cost) return false;
    this.tokens -= cost;
    return true;
  }
}
