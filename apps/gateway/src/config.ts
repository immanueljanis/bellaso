export interface GatewayConfig {
  port: number;
  allowedOrigins: string[];
}

/** Reads the gateway configuration from the environment (TECH_SPEC section 9.6). */
export function readConfig(env: Record<string, string | undefined> = process.env): GatewayConfig {
  const port = Number(env.PORT ?? 8080);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`PORT must be an integer from 0 to 65535, got "${env.PORT}"`);
  }
  const allowedOrigins = (env.ALLOWED_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  return { port, allowedOrigins };
}
