import { searchContractTxs, searchTransferTxs } from "@bellaso/chain";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import type { GatewayConfig } from "./config";
import { AnnouncementIndex, type SearchPage, TransferIndex } from "./indexer";
import { isAllowedRestRead, isAllowedRpcBody } from "./proxy";
import { REFUSALS, type SendUqor, Sponsor, sponsorWallet } from "./sponsor";

export interface GatewayDeps {
  fetch: typeof fetch;
  search?: SearchPage;
  searchTransfers?: SearchPage;
  /** The sponsor sender. Without it, the gateway builds one from `sponsorMnemonic`. */
  send?: SendUqor;
}

const MAX_BODY = 64 * 1024;
const MAX_ANNOUNCEMENTS = 500;
const MAX_TRANSFERS = 1000;

/** The body of both sponsor routes: one bech32 `qor1` account address (20 bytes, 38 data characters). */
const ADDRESS_BODY = {
  type: "object",
  required: ["address"],
  additionalProperties: false,
  properties: { address: { type: "string", pattern: "^qor1[02-9ac-hj-np-z]{38}$" } },
} as const;

/** `after` and `limit` of a page request, with `limit` cut to `max`, or null when one is not a positive integer. */
function pageQuery(query: { after?: string; limit?: string }, max: number): { after: number; limit: number } | null {
  const after = Number(query.after ?? 0);
  const limit = Math.min(Number(query.limit ?? max), max);
  return Number.isInteger(after) && after >= 0 && Number.isInteger(limit) && limit >= 1 ? { after, limit } : null;
}

/**
 * Builds the gateway. The logger is off, so no access log keeps an IP address with a
 * path (TECH_SPEC section 9.2). No route accepts a secret: the REST and RPC routes relay
 * public reads and signed transactions, the indexes serve every item to everyone, and the
 * sponsor routes take a public address only.
 *
 * `trustProxy` trusts the first `trustProxyHops` addresses (the socket peer, then
 * `X-Forwarded-For` from the right), so the rate limit and the sponsor limits count each
 * client, not the Railway proxy. Fastify 5.12 trusts no hop when `trustProxy` is a number,
 * so the hop count goes in as a function. This is safe only while every request comes
 * through the proxy, as on Railway. Ajv keeps extra properties so that
 * `additionalProperties: false` refuses them instead of removing them.
 */
export async function buildApp(config: GatewayConfig, deps: GatewayDeps = { fetch: globalThis.fetch }) {
  const app = Fastify({
    logger: false,
    bodyLimit: MAX_BODY,
    trustProxy: (_address: string, hop: number) => hop < config.trustProxyHops,
    ajv: { customOptions: { removeAdditional: false } },
  });
  await app.register(cors, { origin: config.allowedOrigins });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });

  const search: SearchPage =
    deps.search ?? ((minHeight, page) => searchContractTxs(config.chainRpc, config.announcementContract, { minHeight, page }));
  const announcements = new AnnouncementIndex(config.announcementContract, search);
  const searchTransfers: SearchPage = deps.searchTransfers ?? ((minHeight, page) => searchTransferTxs(config.chainRpc, { minHeight, page }));
  const transfers = new TransferIndex(searchTransfers, config.transfersFromHeight);
  const sponsor = new Sponsor({
    send: deps.send ?? (config.sponsorMnemonic ? sponsorWallet(config.sponsorMnemonic, config.chainRpc, config.chainRest) : undefined),
    fetch: deps.fetch,
    chainRest: config.chainRest,
    amountUqor: config.sponsorAmountUqor,
    dailyCap: config.sponsorDailyCap,
  });

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
    const query = pageQuery(request.query, MAX_ANNOUNCEMENTS);
    if (!query) return reply.code(400).send({ error: "after and limit must be positive integers" });
    await announcements.sync();
    return { ...announcements.page(query.after, query.limit), rejected: announcements.rejected };
  });

  app.get<{ Querystring: { after?: string; limit?: string } }>("/v1/transfers", async (request, reply) => {
    const query = pageQuery(request.query, MAX_TRANSFERS);
    if (!query) return reply.code(400).send({ error: "after and limit must be positive integers" });
    await transfers.sync();
    return transfers.page(query.after, query.limit);
  });

  const sponsorRoute = { schema: { body: ADDRESS_BODY }, attachValidation: true };

  app.post<{ Body: { address: string } }>("/v1/sponsor", sponsorRoute, async (request, reply) => {
    if (request.validationError) return reply.code(400).send({ error: REFUSALS.badAddress });
    const { code, body } = await sponsor.fund(request.body.address, request.ip);
    return reply.code(code).send(body);
  });

  app.post<{ Body: { address: string } }>("/v1/sponsor-gas", sponsorRoute, async (request, reply) => {
    if (request.validationError) return reply.code(400).send({ error: REFUSALS.badAddress });
    const { code, body } = await sponsor.fundGas(request.body.address, request.ip);
    return reply.code(code).send(body);
  });

  return app;
}
