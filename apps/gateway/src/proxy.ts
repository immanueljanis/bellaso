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
] as const;

const SAFE_PATH = /^\/[A-Za-z0-9/_.:%-]*$/;

/** True when `path` is an allowed REST read. Refuses `..` segments and characters outside a plain path. */
export function isAllowedRestRead(path: string): boolean {
  if (!SAFE_PATH.test(path) || path.split("/").includes("..")) return false;
  return REST_READ_PREFIXES.some((prefix) => path.startsWith(prefix));
}
