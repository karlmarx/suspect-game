import { routePartykitRequest } from "partyserver";

export { GameServer } from "./server";
export { IpRateLimiter } from "./rateLimit";

export interface Env {
  Main: DurableObjectNamespace;
  IpLimiter: DurableObjectNamespace;
  APP_PASSWORD?: string;
}

function getClientIp(request: Request): string {
  // CF-Connecting-IP is set by Cloudflare on every edge request; trustworthy.
  return (
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export default {
  async fetch(request, env): Promise<Response> {
    const routed = await routePartykitRequest(
      request,
      env as unknown as Record<string, DurableObjectNamespace>,
      {
        onBeforeConnect: async (req) => {
          const ip = getClientIp(req);
          if (ip === "unknown") return; // Don't reject if CF didn't set the header (local dev)
          const limiter = (env.IpLimiter as DurableObjectNamespace & {
            getByName(name: string): DurableObjectStub;
          }).getByName("global");
          const result = await (limiter as unknown as {
            checkAndReserve(ip: string): Promise<{ allowed: boolean; reason?: string; retryAfterSec?: number }>;
          }).checkAndReserve(ip);
          if (!result.allowed) {
            const headers: HeadersInit = { "Content-Type": "text/plain" };
            if (result.retryAfterSec) headers["Retry-After"] = String(result.retryAfterSec);
            return new Response(
              `Too many connections (${result.reason}). Try again later.`,
              { status: 429, headers },
            );
          }
        },
      },
    );
    return routed ?? new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
