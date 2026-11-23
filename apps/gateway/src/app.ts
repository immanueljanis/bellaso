import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import type { GatewayConfig } from "./config";

/**
 * Builds the gateway. The logger is off, so no access log keeps an IP address with a
 * path (TECH_SPEC section 9.2). No route accepts a secret.
 */
export async function buildApp(config: GatewayConfig) {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: config.allowedOrigins });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  app.get("/v1/health", async () => ({ ok: true }));
  return app;
}
