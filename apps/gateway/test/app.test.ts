import { expect, test } from "bun:test";
import { buildApp } from "../src/app";
import { readConfig } from "../src/config";
import { ipKey, isAllowedRestRead, isAllowedRpcBody } from "../src/proxy";
import { config } from "./fixtures";

/**
 * The first test of this file builds the first app of the process. On a busy machine that cold start took 7 to 17 seconds,
 * which is more than the 5 second default of bun test. The assertions do not change.
 */
const COLD_START_TIMEOUT_MS = 30_000;

/** A fetch double that records the URLs it is asked for and answers with JSON. */
function fakeFetch(calls: string[]): typeof fetch {
  return (async (input: string | URL | Request) => {
    calls.push(String(input));
    return new Response(JSON.stringify({ found: true }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

test("health answers, with CORS only for an allowed origin", async () => {
  const app = await buildApp(config);

  const allowed = await app.inject({ method: "GET", url: "/v1/health", headers: { origin: "http://localhost:3000" } });
  expect(allowed.statusCode).toBe(200);
  expect(allowed.json()).toEqual({ ok: true });
  expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3000");

  const other = await app.inject({ method: "GET", url: "/v1/health", headers: { origin: "https://other.example" } });
  expect(other.headers["access-control-allow-origin"]).toBeUndefined();

  await app.close();
}, COLD_START_TIMEOUT_MS);

test("the REST proxy passes allowed reads and refuses everything else", async () => {
  const calls: string[] = [];
  const app = await buildApp(config, { fetch: fakeFetch(calls) });

  const kem = await app.inject({ method: "GET", url: "/v1/lcd/qorechain/pqc/v1/kem/qor1abc" });
  expect(kem.statusCode).toBe(200);
  expect(kem.json()).toEqual({ found: true });
  expect(calls).toEqual(["https://rest.example/qorechain/pqc/v1/kem/qor1abc"]);

  const supply = await app.inject({ method: "GET", url: "/v1/lcd/cosmos/bank/v1beta1/supply" });
  expect(supply.statusCode).toBe(403);
  const climb = await app.inject({ method: "GET", url: "/v1/lcd/qorechain/pqc/v1/../../cosmos/bank/v1beta1/supply" });
  expect(climb.statusCode).toBe(403);
  expect(calls.length).toBe(1);

  await app.close();
});

test("isAllowedRestRead refuses dot segments and odd characters", () => {
  expect(isAllowedRestRead("/cosmos/auth/v1beta1/accounts/qor1abc")).toBe(true);
  expect(isAllowedRestRead("/qorechain/pqc/v1/../x")).toBe(false);
  expect(isAllowedRestRead("/qorechain/pqc/v1/a?b")).toBe(false);
  expect(isAllowedRestRead("/cosmos/upgrade/v1beta1/applied_plan/v3.2.3")).toBe(true);
  expect(isAllowedRestRead("/cosmos/staking/v1beta1/validators")).toBe(false);
});

test("readConfig refuses a bad port and splits the origins", () => {
  expect(() => readConfig({ PORT: "abc" })).toThrow("PORT must be an integer");
  expect(readConfig({ ALLOWED_ORIGINS: "https://a.example, https://b.example" }).allowedOrigins).toEqual([
    "https://a.example",
    "https://b.example",
  ]);
  expect(readConfig({ CHAIN_REST: "https://rest.example/" }).chainRest).toBe("https://rest.example");
});

test("readConfig gives the sponsor and transfer defaults and refuses bad numbers", () => {
  const defaults = readConfig({});
  expect(defaults.sponsorMnemonic).toBeUndefined();
  expect(defaults.sponsorAmountUqor).toBe(120_000);
  expect(defaults.sponsorDailyCap).toBe(50);
  expect(defaults.transfersFromHeight).toBe(10_600_000);
  expect(defaults.clientIpHeader).toBe("");
  expect(readConfig({ CLIENT_IP_HEADER: " X-Real-IP " }).clientIpHeader).toBe("x-real-ip");
  expect(readConfig({ SPONSOR_MNEMONIC: "  " }).sponsorMnemonic).toBeUndefined();
  expect(() => readConfig({ SPONSOR_AMOUNT_UQOR: "0" })).toThrow("SPONSOR_AMOUNT_UQOR must be an integer");
  expect(() => readConfig({ TRANSFERS_FROM_HEIGHT: "1.5" })).toThrow("TRANSFERS_FROM_HEIGHT must be an integer");
});

test("the RPC proxy passes allowed methods and refuses others", async () => {
  const calls: string[] = [];
  const app = await buildApp(config, { fetch: fakeFetch(calls) });
  const status = await app.inject({ method: "POST", url: "/v1/rpc", payload: { jsonrpc: "2.0", id: 1, method: "status", params: {} } });
  expect(status.statusCode).toBe(200);
  expect(calls).toEqual(["https://rpc.example"]);
  const unsafe = await app.inject({ method: "POST", url: "/v1/rpc", payload: { jsonrpc: "2.0", id: 2, method: "unsafe_flush_mempool" } });
  expect(unsafe.statusCode).toBe(403);
  expect(calls.length).toBe(1);
  await app.close();
});

test("isAllowedRpcBody accepts small batches of allowed methods only", () => {
  expect(isAllowedRpcBody({ method: "abci_query", params: { path: "/cosmos.auth.v1beta1.Query/Account" } })).toBe(true);
  expect(isAllowedRpcBody([{ method: "status" }, { method: "tx" }])).toBe(true);
  expect(isAllowedRpcBody([{ method: "status" }, { method: "dial_peers" }])).toBe(false);
  expect(isAllowedRpcBody(Array.from({ length: 11 }, () => ({ method: "status" })))).toBe(false);
  expect(isAllowedRpcBody("status")).toBe(false);
  expect(isAllowedRpcBody({ method: "tx_search" })).toBe(false);
  expect(isAllowedRpcBody({ method: "tx_search", params: { query: "tx.height>1" } })).toBe(false);
  expect(isAllowedRpcBody({ method: "tx_search", params: { query: "tx.hash='" + "AB".repeat(32) + "' OR tx.height>1" } })).toBe(false);
  expect(isAllowedRpcBody({ method: "tx_search", params: { query: "tx.hash='" + "AB".repeat(32) + "'", page: "1" } })).toBe(true);
});

test("the rate limit counts each client by X-Real-IP, and a forged X-Forwarded-For does not split it", async () => {
  const app = await buildApp(config, { fetch: fakeFetch([]) });
  const hit = (headers: Record<string, string>) => app.inject({ method: "GET", url: "/v1/health", headers });
  const codes: number[] = [];
  for (let n = 0; n < 121; n++) codes.push((await hit({ "x-real-ip": "203.0.113.7", "x-forwarded-for": `10.0.0.${n}` })).statusCode);
  expect(codes.slice(0, 120).every((code) => code === 200)).toBe(true);
  expect(codes[120]).toBe(429);
  expect((await hit({ "x-real-ip": "198.51.100.9" })).statusCode).toBe(200);
  await app.close();
});

test("the REST relay refuses percent-encoded traversal and forwards no query string", async () => {
  const calls: string[] = [];
  const app = await buildApp(config, { fetch: fakeFetch(calls) });
  const encoded = await app.inject({ method: "GET", url: "/v1/lcd/cosmos/bank/v1beta1/balances/qor1x%2f..%2f..%2fsupply" });
  expect(encoded.statusCode).toBe(403);
  const dots = await app.inject({ method: "GET", url: "/v1/lcd/qorechain/pqc/v1/%2e%2e/%2e%2e/cosmos/bank/v1beta1/supply" });
  expect(dots.statusCode).toBe(403);
  const query = await app.inject({ method: "GET", url: "/v1/lcd/cosmos/bank/v1beta1/balances/qor1abc?pagination.limit=1000000" });
  expect(query.statusCode).toBe(200);
  expect(calls).toEqual(["https://rest.example/cosmos/bank/v1beta1/balances/qor1abc"]);
  expect(query.headers["content-type"]).toContain("application/json");
  await app.close();
});

test("every answer carries the security headers, and a failure hides its cause", async () => {
  const app = await buildApp(config, {
    fetch: (async () => {
      throw new Error("connect ECONNREFUSED 10.0.0.1:1317");
    }) as unknown as typeof fetch,
  });
  const health = await app.inject({ method: "GET", url: "/v1/health" });
  expect(health.headers["x-content-type-options"]).toBe("nosniff");
  expect(health.headers["content-security-policy"]).toBe("default-src 'none'; frame-ancestors 'none'");
  expect(health.headers["referrer-policy"]).toBe("no-referrer");
  const failed = await app.inject({ method: "GET", url: "/v1/lcd/qorechain/pqc/v1/kem/qor1abc" });
  expect(failed.statusCode).toBe(502);
  expect(failed.body).not.toContain("ECONNREFUSED");
  expect(failed.json()).toEqual({ error: "The chain did not answer. Try again in a minute." });
  await app.close();
});

test("abci_query passes only for the routes the SDK uses", () => {
  expect(isAllowedRpcBody({ method: "abci_query", params: { path: "/cosmos.auth.v1beta1.Query/Account", data: "0a" } })).toBe(true);
  expect(isAllowedRpcBody({ method: "abci_query", params: { path: "/cosmos.tx.v1beta1.Service/Simulate", data: "0a" } })).toBe(true);
  expect(isAllowedRpcBody({ method: "abci_query", params: { path: "/cosmos.tx.v1beta1.Service/GetTxsEvent" } })).toBe(false);
  expect(isAllowedRpcBody({ method: "abci_query", params: { path: "/store/bank/subspace" } })).toBe(false);
  expect(isAllowedRpcBody({ method: "abci_query" })).toBe(false);
});

test("ipKey keeps IPv4, maps IPv4-in-IPv6 back, and groups IPv6 by /64", () => {
  expect(ipKey("203.0.113.7")).toBe("203.0.113.7");
  expect(ipKey("::ffff:203.0.113.7")).toBe("203.0.113.7");
  expect(ipKey("2001:db8:abcd:12:1:2:3:4")).toBe("2001:db8:abcd:12::/64");
  expect(ipKey("2001:0db8:abcd:0012:ffff::1")).toBe("2001:db8:abcd:12::/64");
  expect(ipKey("2001:db8::1")).toBe("2001:db8:0:0::/64");
});

test("the REST relay refuses the unused contract prefix and an oversized upstream answer", async () => {
  const contract = await (await buildApp(config, { fetch: fakeFetch([]) })).inject({ method: "GET", url: "/v1/lcd/cosmwasm/wasm/v1/contract/qor1abc/smart/eyJ9" });
  expect(contract.statusCode).toBe(403);
  const huge = (async () => new Response("x", { status: 200, headers: { "content-length": String(3 * 1024 * 1024) } })) as unknown as typeof fetch;
  const app = await buildApp(config, { fetch: huge });
  const big = await app.inject({ method: "GET", url: "/v1/lcd/qorechain/pqc/v1/kem/qor1abc" });
  expect(big.statusCode).toBe(502);
  await app.close();
});
