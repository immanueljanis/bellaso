import { TESTNET } from "@bellaso/chain";

export interface GatewayConfig {
  port: number;
  allowedOrigins: string[];
  chainRest: string;
  chainRpc: string;
  announcementContract: string;
  /** The recovery phrase of the sponsor wallet. Without it, the sponsor routes answer 503. */
  sponsorMnemonic?: string;
  /** The setup amount. Gates G1 and G2 paid 58,763 + 38,120 uqor, so 120,000 leaves a margin. */
  sponsorAmountUqor: number;
  /** The most sponsorships (setup and gas together) in 24 hours. */
  sponsorDailyCap: number;
  /** The first height of the transfer index. Older transfers are not served. */
  transfersFromHeight: number;
  /** Proxies in front of the gateway (Railway: 1). Fastify takes the client IP after that many hops. */
  trustProxyHops: number;
}

const trimSlash = (url: string) => url.replace(/\/+$/, "");

/** An integer variable from `min` to `max`, or `fallback` when it is not set. */
function integer(env: Record<string, string | undefined>, name: string, fallback: number, min: number, max = Number.MAX_SAFE_INTEGER): number {
  const value = Number(env[name] ?? fallback);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}, got "${env[name]}"`);
  }
  return value;
}

/** Reads the gateway configuration from the environment (TECH_SPEC section 9.6). */
export function readConfig(env: Record<string, string | undefined> = process.env): GatewayConfig {
  const allowedOrigins = (env.ALLOWED_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  return {
    port: integer(env, "PORT", 8080, 0, 65535),
    allowedOrigins,
    chainRest: trimSlash(env.CHAIN_REST ?? TESTNET.rest),
    chainRpc: trimSlash(env.CHAIN_RPC ?? TESTNET.rpc),
    announcementContract: env.ANNOUNCEMENT_CONTRACT ?? TESTNET.announcementContract,
    sponsorMnemonic: env.SPONSOR_MNEMONIC?.trim() || undefined,
    sponsorAmountUqor: integer(env, "SPONSOR_AMOUNT_UQOR", 120_000, 1),
    sponsorDailyCap: integer(env, "SPONSOR_DAILY_CAP", 50, 0),
    transfersFromHeight: integer(env, "TRANSFERS_FROM_HEIGHT", 10_600_000, 0),
    trustProxyHops: integer(env, "TRUST_PROXY_HOPS", 1, 0),
  };
}
