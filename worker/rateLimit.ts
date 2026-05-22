import { DurableObject } from "cloudflare:workers";

export { TokenBucket } from "./tokenBucket";

/**
 * Per-IP rate limiter shared across all rooms via a single Durable Object.
 * Tracks (a) new-connection attempts per IP per minute and (b) total
 * concurrent connections per IP. Sliding-window counter via a ring buffer
 * persisted to DO storage so it survives hibernation.
 *
 * Use via `env.IpLimiter.getByName("global")` from the entry worker's
 * onBeforeConnect hook.
 */
export interface IpCheckResult {
  allowed: boolean;
  reason?: "rate" | "concurrent";
  retryAfterSec?: number;
}

interface IpRecord {
  /** Unix ms timestamps of new-connection attempts in the last 60s. */
  attempts: number[];
  /** Live connections currently held open. */
  concurrent: number;
  lastSeen: number;
}

const NEW_CONN_LIMIT_PER_MIN = 12;
const CONCURRENT_LIMIT_PER_IP = 8;
const WINDOW_MS = 60_000;
/** Drop IP records that haven't been touched in 10 minutes. */
const GC_AFTER_MS = 10 * 60_000;

export class IpRateLimiter extends DurableObject {
  // In-memory cache; rebuilt from storage on cold start via blockConcurrencyWhile.
  private cache = new Map<string, IpRecord>();

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env as never);
    ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.list<IpRecord>({ prefix: "ip:" });
      for (const [k, v] of stored) {
        this.cache.set(k.slice(3), v);
      }
    });
  }

  async checkAndReserve(ip: string): Promise<IpCheckResult> {
    const now = Date.now();
    const rec: IpRecord = this.cache.get(ip) ?? { attempts: [], concurrent: 0, lastSeen: now };

    // Trim window
    rec.attempts = rec.attempts.filter((t) => now - t < WINDOW_MS);

    if (rec.attempts.length >= NEW_CONN_LIMIT_PER_MIN) {
      const oldest = rec.attempts[0];
      const retryAfterSec = Math.ceil((WINDOW_MS - (now - oldest)) / 1000);
      this.cache.set(ip, rec);
      return { allowed: false, reason: "rate", retryAfterSec };
    }
    if (rec.concurrent >= CONCURRENT_LIMIT_PER_IP) {
      this.cache.set(ip, rec);
      return { allowed: false, reason: "concurrent" };
    }

    rec.attempts.push(now);
    rec.concurrent += 1;
    rec.lastSeen = now;
    this.cache.set(ip, rec);
    await this.ctx.storage.put(`ip:${ip}`, rec);
    this.scheduleGc(now);
    return { allowed: true };
  }

  async release(ip: string): Promise<void> {
    const rec = this.cache.get(ip);
    if (!rec) return;
    rec.concurrent = Math.max(0, rec.concurrent - 1);
    rec.lastSeen = Date.now();
    this.cache.set(ip, rec);
    await this.ctx.storage.put(`ip:${ip}`, rec);
  }

  /** Schedule the next GC run (alarm-driven; idempotent). */
  private async scheduleGc(now: number): Promise<void> {
    const existing = await this.ctx.storage.getAlarm();
    if (existing == null || existing < now) {
      await this.ctx.storage.setAlarm(now + GC_AFTER_MS);
    }
  }

  async alarm(): Promise<void> {
    const cutoff = Date.now() - GC_AFTER_MS;
    const keysToDelete: string[] = [];
    for (const [ip, rec] of this.cache) {
      if (rec.lastSeen < cutoff && rec.concurrent === 0) {
        keysToDelete.push(ip);
      }
    }
    for (const ip of keysToDelete) {
      this.cache.delete(ip);
      await this.ctx.storage.delete(`ip:${ip}`);
    }
    // Re-arm if any state remains
    if (this.cache.size > 0) {
      await this.ctx.storage.setAlarm(Date.now() + GC_AFTER_MS);
    }
  }
}
