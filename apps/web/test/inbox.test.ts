import { expect, test } from "bun:test";
import { addressOf, encodeAnnouncement, makePaymentTarget } from "@bellaso/core";
import { deriveRecipient } from "../src/chain-client";
import { matchStealth, mergePayments, openItem } from "../src/inbox";

const MNEMONIC = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

const toBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

test("openItem finds a payment to this recipient and ignores one to another recipient", async () => {
  const me = await deriveRecipient(MNEMONIC);
  const other = await deriveRecipient("legal winner thank year wave sausage worth useful legal winner thank yellow");
  const mine = makePaymentTarget(me.keys.publicKey, me.kemPublicKey);
  const theirs = makePaymentTarget(other.keys.publicKey, other.kemPublicKey);
  const coin = [{ denom: "uqor", amount: "150000" }];
  const item = (target: typeof mine, hash: string) => ({
    txHash: hash,
    height: 10,
    transfers: [{ from: "qor1payer", to: target.address, amount: coin }],
    announcement: toBase64(encodeAnnouncement(target)),
  });

  const found = openItem(me.keys, item(mine, "AAA"));
  expect(found).toHaveLength(1);
  expect(found[0]).toMatchObject({ method: "link", txHash: "AAA", address: mine.address, amount: coin });
  expect(openItem(me.keys, item(theirs, "BBB"))).toEqual([]);
  expect(openItem(me.keys, { ...item(mine, "CCC"), announcement: "AAAA" })).toEqual([]);
  expect(addressOf(me.keys.publicKey)).not.toBe(mine.address);
}, 30_000);

test("matchStealth keeps only transfers to vault addresses, and mergePayments keeps the spend status", () => {
  const stealth = [{ index: 0, address: "qor1stealth0", label: "Studio Kyoto", createdAt: "", askGas: false }];
  const transfers = [
    { txHash: "T1", height: 5, msgIndex: 0, from: "qor1a", to: "qor1stealth0", amount: [{ denom: "uqor", amount: "1" }] },
    { txHash: "T2", height: 6, msgIndex: 0, from: "qor1a", to: "qor1other", amount: [{ denom: "uqor", amount: "1" }] },
  ];
  const found = matchStealth(stealth, transfers);
  expect(found).toEqual([{ method: "stealth", txHash: "T1", height: 5, address: "qor1stealth0", amount: transfers[0]!.amount, index: 0 }]);
  const merged = mergePayments([{ ...found[0]!, spentTx: "S1" }], found);
  expect(merged[0]!.spentTx).toBe("S1");
});
