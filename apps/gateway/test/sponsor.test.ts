import { expect, test } from "bun:test";
import { type Coin, TESTNET } from "@bellaso/chain";
import { buildApp } from "../src/app";
import { GAS_UQOR, REFUSALS, type SendUqor, Sponsor } from "../src/sponsor";
import { config } from "./fixtures";

interface FakeAddress {
  account: { pub_key: unknown } | null;
  balances: Coin[];
}

const CHARSET = "023456789acdefghjklmnpqrstuvwxyz";
const FUSD = TESTNET.denoms.fUSD.denom;

/** A well-formed qor1 address (38 data characters) for each `n` from 0 to 31. The checksum is not real. */
const address = (n: number) => `qor1${"q".repeat(37)}${CHARSET[n]}`;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/**
 * A REST double for the account and balance reads. An address that is not in `chain` has no
 * account (404 with code 5, as the testnet answers) and no balance. Each path goes into `calls`.
 */
function fakeChain(chain: Record<string, FakeAddress> = {}, calls: string[] = []): typeof fetch {
  return (async (input: string | URL | Request) => {
    const { pathname } = new URL(String(input));
    calls.push(pathname);
    const key = pathname.split("/").pop()!;
    const entry = chain[key] ?? { account: null, balances: [] };
    if (pathname.startsWith("/cosmos/auth/v1beta1/accounts/")) {
      return entry.account ? json(200, { account: entry.account }) : json(404, { code: 5, message: `account ${key} not found`, details: [] });
    }
    return json(200, { balances: entry.balances, pagination: { total: String(entry.balances.length) } });
  }) as typeof fetch;
}

/** A sender double that records each send and answers a fake transaction hash. */
function fakeSend(sent: [string, number][]): SendUqor {
  return async (to, uqor) => {
    sent.push([to, uqor]);
    return `TX${sent.length}`;
  };
}

const post = (url: string, body: unknown, forwardedFor?: string) => ({
  method: "POST" as const,
  url,
  payload: body as object,
  headers: forwardedFor ? { "x-real-ip": forwardedFor } : {},
});

test("POST /v1/sponsor funds a new account one time and refuses an existing account", async () => {
  const sent: [string, number][] = [];
  const chain = { [address(9)]: { account: { pub_key: null }, balances: [] } };
  const app = await buildApp(config, { fetch: fakeChain(chain), send: fakeSend(sent) });

  const first = await app.inject(post("/v1/sponsor", { address: address(1) }));
  expect(first.statusCode).toBe(200);
  expect(first.json()).toEqual({ txHash: "TX1" });
  expect(sent).toEqual([[address(1), config.sponsorAmountUqor]]);

  const again = await app.inject(post("/v1/sponsor", { address: address(1) }));
  expect(again.statusCode).toBe(409);
  expect(again.json()).toEqual({ error: REFUSALS.funded });

  const existing = await app.inject(post("/v1/sponsor", { address: address(9) }));
  expect(existing.statusCode).toBe(409);
  expect(existing.json()).toEqual({ error: REFUSALS.exists });
  expect(sent.length).toBe(1);
  await app.close();
});

test("the sponsor routes refuse extra properties and bad addresses before any chain read", async () => {
  const sent: [string, number][] = [];
  const calls: string[] = [];
  const app = await buildApp(config, { fetch: fakeChain({}, calls), send: fakeSend(sent) });
  const bodies = [
    { address: address(1), mnemonic: "secret words" },
    {},
    { address: `cosmos1${"q".repeat(38)}` },
    { address: address(1).toUpperCase() },
    { address: `${address(1)}q` },
    { address: address(1).slice(0, -1) },
    { address: `qor1${"b".repeat(38)}` },
    { address: 42 },
  ];
  for (const url of ["/v1/sponsor", "/v1/sponsor-gas"]) {
    for (const body of bodies) {
      const response = await app.inject(post(url, body));
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: REFUSALS.badAddress });
    }
  }
  expect(calls).toEqual([]);
  expect(sent).toEqual([]);
  await app.close();
});

test("without a sponsor wallet both sponsor routes answer 503", async () => {
  const app = await buildApp(config, { fetch: fakeChain() });
  for (const url of ["/v1/sponsor", "/v1/sponsor-gas"]) {
    const response = await app.inject(post(url, { address: address(1) }));
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: REFUSALS.unavailable });
  }
  await app.close();
});

test("the IP limit counts X-Real-IP from the edge, and a forged X-Forwarded-For does not change it", async () => {
  const sent: [string, number][] = [];
  const app = await buildApp(config, { fetch: fakeChain(), send: fakeSend(sent) });
  const ask = (n: number, realIp: string) =>
    app.inject({
      method: "POST",
      url: "/v1/sponsor",
      payload: { address: address(n) },
      headers: { "x-real-ip": realIp, "x-forwarded-for": `10.9.9.${n}` },
    });
  for (const n of [1, 2, 3]) expect((await ask(n, "203.0.113.7")).statusCode).toBe(200);
  const fourth = await ask(4, "203.0.113.7");
  expect(fourth.statusCode).toBe(429);
  expect(fourth.json()).toEqual({ error: REFUSALS.ipLimit });
  expect((await ask(4, "198.51.100.9")).statusCode).toBe(200);
  expect(sent.map(([to]) => to)).toEqual([address(1), address(2), address(3), address(4)]);
  await app.close();
});

test("the daily cap counts setup and gas sponsorships together", async () => {
  const sent: [string, number][] = [];
  const chain = { [address(2)]: { account: { pub_key: null }, balances: [{ denom: FUSD, amount: "5" }] } };
  const app = await buildApp({ ...config, sponsorDailyCap: 2 }, { fetch: fakeChain(chain), send: fakeSend(sent) });
  expect((await app.inject(post("/v1/sponsor", { address: address(1) }, "192.0.2.1"))).statusCode).toBe(200);
  expect((await app.inject(post("/v1/sponsor-gas", { address: address(2) }, "192.0.2.2"))).statusCode).toBe(200);
  const third = await app.inject(post("/v1/sponsor", { address: address(3) }, "192.0.2.3"));
  expect(third.statusCode).toBe(429);
  expect(third.json()).toEqual({ error: REFUSALS.dailyCap });
  await app.close();
});

test("a failed chain read or send answers 502 and gives the place back", async () => {
  let fail = true;
  const sent: [string, number][] = [];
  const send: SendUqor = async (to, uqor) => {
    if (fail) throw new Error("broadcast refused");
    sent.push([to, uqor]);
    return "TX1";
  };
  const app = await buildApp({ ...config, sponsorDailyCap: 1 }, { fetch: fakeChain(), send });
  const failed = await app.inject(post("/v1/sponsor", { address: address(1) }));
  expect(failed.statusCode).toBe(502);
  expect(failed.json()).toEqual({ error: REFUSALS.failed });
  fail = false;
  expect((await app.inject(post("/v1/sponsor", { address: address(1) }))).statusCode).toBe(200);
  await app.close();

  const down = (async () => json(500, { code: 13 })) as unknown as typeof fetch;
  const offline = await buildApp(config, { fetch: down, send });
  const unread = await offline.inject(post("/v1/sponsor", { address: address(1) }));
  expect(unread.statusCode).toBe(502);
  expect(unread.json()).toEqual({ error: REFUSALS.failed });
  await offline.close();
});

test("sponsor sends run one at a time", async () => {
  let running = 0;
  let most = 0;
  const send: SendUqor = async (to) => {
    running++;
    most = Math.max(most, running);
    await new Promise((resolve) => setTimeout(resolve, 20));
    running--;
    return `TX-${to.slice(-1)}`;
  };
  const app = await buildApp(config, { fetch: fakeChain(), send });
  const answers = await Promise.all([1, 2, 3].map((n) => app.inject(post("/v1/sponsor", { address: address(n) }))));
  expect(answers.map((answer) => answer.statusCode)).toEqual([200, 200, 200]);
  expect(most).toBe(1);
  await app.close();
});

test("POST /v1/sponsor-gas funds only an unsigned address that holds a payment and little QOR", async () => {
  const sent: [string, number][] = [];
  const fusd = { denom: FUSD, amount: "5" };
  const chain: Record<string, FakeAddress> = {
    [address(1)]: { account: { pub_key: null }, balances: [fusd, { denom: "uqor", amount: "119999" }] },
    [address(2)]: { account: { pub_key: null }, balances: [{ denom: "uqor", amount: "10" }] },
    [address(3)]: { account: { pub_key: null }, balances: [{ denom: FUSD, amount: "0" }] },
    [address(4)]: { account: { pub_key: null }, balances: [fusd, { denom: "uqor", amount: "120000" }] },
    [address(5)]: { account: { pub_key: { "@type": "/cosmos.crypto.secp256k1.PubKey", key: "Am4n" } }, balances: [fusd] },
  };
  const app = await buildApp(config, { fetch: fakeChain(chain), send: fakeSend(sent) });
  const ask = async (n: number, ip: string) => {
    const response = await app.inject(post("/v1/sponsor-gas", { address: address(n) }, ip));
    return { code: response.statusCode, body: response.json() };
  };

  expect(await ask(1, "192.0.2.1")).toEqual({ code: 200, body: { txHash: "TX1" } });
  expect(sent).toEqual([[address(1), GAS_UQOR]]);
  expect(await ask(1, "192.0.2.2")).toEqual({ code: 409, body: { error: REFUSALS.funded } });
  expect(await ask(2, "192.0.2.2")).toEqual({ code: 409, body: { error: REFUSALS.noPayment } });
  expect(await ask(3, "192.0.2.2")).toEqual({ code: 409, body: { error: REFUSALS.noPayment } });
  expect(await ask(4, "192.0.2.2")).toEqual({ code: 409, body: { error: REFUSALS.hasGas } });
  expect(await ask(5, "192.0.2.2")).toEqual({ code: 409, body: { error: REFUSALS.signed } });
  expect(await ask(6, "192.0.2.2")).toEqual({ code: 409, body: { error: REFUSALS.noPayment } });
  expect(sent.length).toBe(1);
  await app.close();
});

test("an IP address gets one more sponsorship when its oldest one is 24 hours old", async () => {
  const hour = 60 * 60 * 1000;
  let clock = 0;
  const sent: [string, number][] = [];
  const sponsor = new Sponsor({
    send: fakeSend(sent),
    fetch: fakeChain(),
    chainRest: "https://rest.example",
    amountUqor: 1,
    dailyCap: 50,
    now: () => clock,
  });
  for (const n of [1, 2, 3]) {
    clock = (n - 1) * hour;
    expect((await sponsor.fund(address(n), "192.0.2.1")).code).toBe(200);
  }
  expect((await sponsor.fund(address(4), "192.0.2.1")).code).toBe(429);
  clock = 24 * hour - 1;
  expect((await sponsor.fund(address(4), "192.0.2.1")).code).toBe(429);
  clock = 24 * hour;
  expect((await sponsor.fund(address(4), "192.0.2.1")).code).toBe(200);
  expect((await sponsor.fund(address(5), "192.0.2.1")).code).toBe(429);
  expect((await sponsor.fund(address(5), "192.0.2.2")).code).toBe(200);
});
