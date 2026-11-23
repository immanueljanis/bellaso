import { expect, test } from "bun:test";
import { buildApp } from "../src/app";
import { AnnouncementIndex, type SearchPage } from "../src/indexer";
import { CONTRACT, paymentTx, validNotes } from "./fixtures";

const txs = [
  { hash: "AAA", height: 10, tx: paymentTx("qor1onetime1", validNotes()) },
  { hash: "BBB", height: 11, tx: paymentTx("qor1junk", ["BL1:7:not-base32768"]) },
  { hash: "CCC", height: 12, tx: paymentTx("qor1onetime2", validNotes()) },
];

/** A search double that returns `txs` at or above `minHeight` and counts its calls. */
function fakeSearch(calls: number[]): SearchPage {
  return async (minHeight) => {
    calls.push(minHeight);
    const found = txs.filter((t) => t.height >= minHeight);
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
  const config = {
    port: 0,
    allowedOrigins: ["http://localhost:3000"],
    chainRest: "https://rest.example",
    chainRpc: "https://rpc.example",
    announcementContract: CONTRACT,
  };
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
