import { searchContractTxs } from "@bellaso/chain";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import type { GatewayConfig } from "./config";
import { AnnouncementIndex, type SearchPage } from "./indexer";
import { isAllowedRestRead, isAllowedRpcBody } from "./proxy";

export interface GatewayDeps {
  fetch: typeof fetch;
  search?: SearchPage;
}

const MAX_BODY = 64 * 1024;
const MAX_LIMIT = 500;

/**
 * Builds the gateway. The logger is off, so no access log keeps an IP address with a
 * path (TECH_SPEC section 9.2). No route accepts a secret: the REST and RPC routes relay
 * public reads and signed transactions, and the index serves every announcement to everyone.
 */
export async function buildApp(config: GatewayConfig, deps: GatewayDeps = { fetch: globalThis.fetch }) {
  const app = Fastify({ logger: false, bodyLimit: MAX_BODY });
  await app.register(cors, { origin: config.allowedOrigins });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });

  const search: SearchPage =
    deps.search ?? ((minHeight, page) => searchContractTxs(config.chainRpc, config.announcementContract, { minHeight, page }));
  const index = new AnnouncementIndex(config.announcementContract, search);

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

  app.post("/v1/rpc", async (request, reply) => {
    if (!isAllowedRpcBody(request.body)) return reply.code(403).send({ error: "This RPC method is not allowed" });
    const upstream = await deps.fetch(config.chainRpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(30_000),
    });
    return reply.code(upstream.status).type("application/json").send(await upstream.text());
  });

  app.get<{ Querystring: { after?: string; limit?: string } }>("/v1/announcements", async (request, reply) => {
    const after = Number(request.query.after ?? 0);
    const limit = Math.min(Number(request.query.limit ?? MAX_LIMIT), MAX_LIMIT);
    if (!Number.isInteger(after) || after < 0 || !Number.isInteger(limit) || limit < 1) {
      return reply.code(400).send({ error: "after and limit must be positive integers" });
    }
    await index.sync();
    return { ...index.page(after, limit), rejected: index.rejected };
  });

  return app;
}
