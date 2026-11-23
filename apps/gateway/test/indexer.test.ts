import { expect, test } from "bun:test";
import { type SearchedTx, TESTNET } from "@bellaso/chain";
import { buildApp } from "../src/app";
import { AnnouncementIndex, type SearchPage, TransferIndex } from "../src/indexer";
import { CONTRACT, config, paymentTx, transferTx, validNotes } from "./fixtures";

const txs = [
  { hash: "AAA", height: 10, tx: paymentTx("qor1onetime1", validNotes()) },
  { hash: "BBB", height: 11, tx: paymentTx("qor1junk", ["BL1:7:not-base32768"]) },
  { hash: "CCC", height: 12, tx: paymentTx("qor1onetime2", validNotes()) },
];

const { fUSD, fETH, fBTC } = TESTNET.denoms;
const transfers = [
  { hash: "T1", height: 100, tx: transferTx([[{ denom: "uatom", amount: "5" }], [{ denom: "uqor", amount: "10" }]]) },
  { hash: "T2", height: 101, tx: transferTx([[{ denom: fUSD.denom, amount: "1" }], [{ denom: "uatom", amount: "3" }, { denom: fBTC.denom, amount: "2" }]]) },
  { hash: "T3", height: 102, tx: transferTx([[{ denom: "uatom", amount: "9" }]]) },
  { hash: "T4", height: 103, tx: transferTx([[{ denom: fETH.denom, amount: "7" }]]) },
];

/** A search double that returns the transactions of `list` at or above `minHeight` and records each `minHeight`. */
function fakeSearch(calls: number[], list: SearchedTx[] = txs): SearchPage {
  return async (minHeight) => {
    calls.push(minHeight);
    const found = list.filter((t) => t.height >= minHeight);
    return { total: found.length, txs: found };
  };
}

test("the index keeps valid announcements, counts broken record sets, and pages by height", async () => {
  const calls: number[] = [];
  let clock = 0;
  const index = new AnnouncementIndex(CONTRACT, fakeSearch(calls), () => clock);
  await index.sync();
  expect(index.items.map((item) => item.txHash)).toEqual(["AAA", "CCC"]);
  expect(index.rejected).toBe(1);
  expect(index.items[0]!.transfers[0]!.to).toBe("qor1onetime1");
  expect(Buffer.from(index.items[0]!.announcement, "base64").length).toBe(1570);
  expect(index.page(10, 500).items.map((item) => item.txHash)).toEqual(["CCC"]);
  expect(index.page(0, 1)).toEqual({ items: [index.items[0]!], next: 10 });

  await index.sync();
  expect(calls.length).toBe(1);
  clock = 5_000;
  await index.sync();
  expect(calls).toEqual([0, 13]);
  expect(index.items.length).toBe(2);
});

test("GET /v1/announcements serves every announcement and refuses bad parameters", async () => {
  const app = await buildApp(config, { fetch: globalThis.fetch, search: fakeSearch([]) });
  const all = await app.inject({ method: "GET", url: "/v1/announcements" });
  expect(all.statusCode).toBe(200);
  expect(all.json().items.length).toBe(2);
  expect(all.json().rejected).toBe(1);
  const later = await app.inject({ method: "GET", url: "/v1/announcements?after=10" });
  expect(later.json().items.map((item: { txHash: string }) => item.txHash)).toEqual(["CCC"]);
  const bad = await app.inject({ method: "GET", url: "/v1/announcements?after=-1" });
  expect(bad.statusCode).toBe(400);
  await app.close();
});

test("the transfer index keeps each MsgSend of the four test denoms, from its first height", async () => {
  const calls: number[] = [];
  let clock = 0;
  const index = new TransferIndex(fakeSearch(calls, transfers), 100, () => clock);
  await index.sync();
  expect(calls).toEqual([100]);
  expect(index.items.map((item) => `${item.txHash}#${item.msgIndex}`)).toEqual(["T1#1", "T2#0", "T2#1", "T4#0"]);
  expect(index.items[0]).toEqual({
    txHash: "T1",
    height: 100,
    msgIndex: 1,
    from: "qor1payer",
    to: "qor1to1",
    amount: [{ denom: "uqor", amount: "10" }],
  });
  expect(index.items[2]!.amount).toEqual([
    { denom: "uatom", amount: "3" },
    { denom: fBTC.denom, amount: "2" },
  ]);

  clock = 5_000;
  await index.sync();
  expect(calls).toEqual([100, 104]);
  expect(index.items.length).toBe(4);
});

test("a page keeps every item of its last height, so after=next skips none", async () => {
  const index = new TransferIndex(fakeSearch([], transfers), 0);
  await index.sync();
  const first = index.page(0, 2);
  expect(first.items.map((item) => `${item.txHash}#${item.msgIndex}`)).toEqual(["T1#1", "T2#0", "T2#1"]);
  expect(first.next).toBe(101);
  const second = index.page(first.next, 2);
  expect(second.items.map((item) => item.txHash)).toEqual(["T4"]);
  expect(index.page(second.next, 2)).toEqual({ items: [], next: 103 });
});

test("GET /v1/transfers serves every transfer by height and refuses bad parameters", async () => {
  const calls: number[] = [];
  const app = await buildApp({ ...config, transfersFromHeight: 100 }, { fetch: globalThis.fetch, searchTransfers: fakeSearch(calls, transfers) });
  const all = await app.inject({ method: "GET", url: "/v1/transfers" });
  expect(all.statusCode).toBe(200);
  expect(calls).toEqual([100]);
  expect(all.json().items.length).toBe(4);
  expect(all.json().next).toBe(103);

  const later = await app.inject({ method: "GET", url: "/v1/transfers?after=101&limit=1000" });
  expect(later.json()).toEqual({
    items: [{ txHash: "T4", height: 103, msgIndex: 0, from: "qor1payer", to: "qor1to0", amount: [{ denom: fETH.denom, amount: "7" }] }],
    next: 103,
  });
  const capped = await app.inject({ method: "GET", url: "/v1/transfers?limit=5000" });
  expect(capped.statusCode).toBe(200);

  for (const query of ["after=-1", "after=abc", "limit=0", "limit=2.5"]) {
    const bad = await app.inject({ method: "GET", url: `/v1/transfers?${query}` });
    expect(bad.statusCode).toBe(400);
    expect(bad.json()).toEqual({ error: "after and limit must be positive integers" });
  }
  await app.close();
});
