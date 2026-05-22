import { routePartykitRequest } from "partyserver";

export { GameServer } from "./server";

export interface Env {
  Main: DurableObjectNamespace;
  APP_PASSWORD?: string;
}

export default {
  async fetch(request, env): Promise<Response> {
    return (
      (await routePartykitRequest(request, env as unknown as Record<string, DurableObjectNamespace>)) ??
      new Response("Not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
