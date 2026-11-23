/**
 * REST paths a browser may read through the gateway (TECH_SPEC section 9.3). Each one
 * returns public chain data. Anything else gets 403, so the gateway is not an open
 * proxy (THREAT_MODEL R21).
 */
export const REST_READ_PREFIXES = [
  "/cosmos/auth/v1beta1/accounts/",
  "/cosmos/bank/v1beta1/balances/",
  "/qorechain/pqc/v1/",
  "/cosmwasm/wasm/v1/contract/",
  "/cosmos/tx/v1beta1/txs/",
  "/cosmos/upgrade/v1beta1/applied_plan/",
] as const;

/**
 * CometBFT JSON-RPC methods the browser may call through `/v1/rpc` (TECH_SPEC section 9.3):
 * what a signing client needs to read an account, simulate, broadcast and wait.
 */
export const RPC_METHODS = new Set(["status", "abci_info", "abci_query", "broadcast_tx_sync", "tx", "tx_search", "block"]);

/** The only `tx_search` query allowed: one transaction by hash. CosmJS `getTx` waits for a broadcast with it. */
const TX_BY_HASH = /^tx\.hash='[0-9A-Fa-f]{64}'$/;

interface RpcCall {
  method?: unknown;
  params?: { query?: unknown };
}

/** True when one JSON-RPC call uses an allowed method, and a `tx_search` asks for one hash only. */
function isAllowedCall(call: unknown): boolean {
  if (typeof call !== "object" || call === null) return false;
  const { method, params } = call as RpcCall;
  if (typeof method !== "string" || !RPC_METHODS.has(method)) return false;
  return method !== "tx_search" || (typeof params?.query === "string" && TX_BY_HASH.test(params.query));
}

/** True when a JSON-RPC body (one call or a batch of 10 or fewer) uses only allowed calls. */
export function isAllowedRpcBody(body: unknown): boolean {
  const calls = Array.isArray(body) ? body : [body];
  return calls.length > 0 && calls.length <= 10 && calls.every(isAllowedCall);
}

const SAFE_PATH = /^\/[A-Za-z0-9/_.-]*$/;

/**
 * True when `path` is an allowed REST read. Refuses `.` and `..` segments and every character
 * outside a plain path, `%` included: the upstream decodes `%2f` and `%2e`, so an encoded
 * segment could climb out of an allowed prefix (MEASURED on 23 Nov 2026, now refused).
 */
export function isAllowedRestRead(path: string): boolean {
  if (!SAFE_PATH.test(path) || path.split("/").some((segment) => segment === ".." || segment === ".")) return false;
  return REST_READ_PREFIXES.some((prefix) => path.startsWith(prefix));
}
