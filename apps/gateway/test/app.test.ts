import { expect, test } from "bun:test";
import { buildApp } from "../src/app";
import { readConfig } from "../src/config";
import { isAllowedRestRead, isAllowedRpcBody } from "../src/proxy";
import { config } from "./fixtures";

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
});

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
  expect(defaults.sponsorAmountUqor).toBe(100_000);
  expect(defaults.sponsorDailyCap).toBe(50);
  expect(defaults.transfersFromHeight).toBe(10_600_000);
  expect(defaults.trustProxyHops).toBe(1);
  expect(readConfig({ SPONSOR_MNEMONIC: "  " }).sponsorMnemonic).toBeUndefined();
  expect(() => readConfig({ TRUST_PROXY_HOPS: "-1" })).toThrow("TRUST_PROXY_HOPS must be an integer");
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
  expect(isAllowedRpcBody({ method: "abci_query" })).toBe(true);
  expect(isAllowedRpcBody([{ method: "status" }, { method: "tx" }])).toBe(true);
  expect(isAllowedRpcBody([{ method: "status" }, { method: "dial_peers" }])).toBe(false);
  expect(isAllowedRpcBody(Array.from({ length: 11 }, () => ({ method: "status" })))).toBe(false);
  expect(isAllowedRpcBody("status")).toBe(false);
});
