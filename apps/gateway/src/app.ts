import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import type { GatewayConfig } from "./config";
import { isAllowedRestRead } from "./proxy";

export interface GatewayDeps {
  fetch: typeof fetch;
}

/**
 * Builds the gateway. The logger is off, so no access log keeps an IP address with a
 * path (TECH_SPEC section 9.2). No route accepts a secret.
 */
export async function buildApp(config: GatewayConfig, deps: GatewayDeps = { fetch: globalThis.fetch }) {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: config.allowedOrigins });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });

  app.get("/v1/health", async () => ({ ok: true }));

  app.get("/v1/lcd/*", async (request, reply) => {
    const url = new URL(request.url, "http://gateway");
    const path = url.pathname.startsWith("/v1/lcd/") ? url.pathname.slice("/v1/lcd".length) : "";
    if (!isAllowedRestRead(path)) return reply.code(403).send({ error: "This path is not allowed" });
    const upstream = await deps.fetch(`${config.chainRest}${path}${url.search}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    return reply
      .code(upstream.status)
      .type(upstream.headers.get("content-type") ?? "application/json")
      .send(await upstream.text());
  });

  return app;
}
