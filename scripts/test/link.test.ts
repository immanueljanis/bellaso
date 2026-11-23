import { describe, expect, test } from "bun:test";
import { addressOf, makePaymentTarget, publicKeyOf } from "@bellaso/core";
import type { SearchedTxWithEvents, TxEvent } from "@bellaso/chain";
import { deriveSealKeys } from "@qorechain/qoreseal";
import { generateMnemonic, qorToEvm } from "@qorechain/sdk";
import { linkHeuristics } from "../lib/link";
import type { AnnouncementItem } from "../lib/scan";

const publicKey = publicKeyOf(new Uint8Array(32).fill(7));
const account = addressOf(publicKey);
const kemPublicKey = deriveSealKeys({ mnemonic: generateMnemonic(256), index: 0 }).mlkemPublicKey;
const other = (n: number) => addressOf(publicKeyOf(new Uint8Array(32).fill(n)));
const [payer1, payer2, funder, destination1, destination2, feeCollector] = [11, 12, 13, 14, 15, 16].map(other) as [
  string,
  string,
  string,
  string,
  string,
  string,
];

/** A transfer event of a message. */
const send = (from: string, to: string): TxEvent => ({
  type: "transfer",
  attributes: [
    { key: "recipient", value: to },
    { key: "sender", value: from },
    { key: "amount", value: "1uqor" },
    { key: "msg_index", value: "0" },
  ],
});

/** A fee transfer event: it has no `msg_index`. */
const fee = (from: string): TxEvent => ({
  type: "transfer",
  attributes: [
    { key: "recipient", value: feeCollector },
    { key: "sender", value: from },
    { key: "amount", value: "1uqor" },
  ],
});

let height = 0;
const tx = (events: TxEvent[], body = ""): SearchedTxWithEvents => ({
  hash: `TX${++height}`,
  height,
  tx: new TextEncoder().encode(body),
  events,
});

/** A real method 1 payment to A from `payer`, with its announcement. */
function payment(payer: string): { item: AnnouncementItem; address: string } {
  const target = makePaymentTarget(publicKey, kemPublicKey);
  const item = {
    txHash: `PAY${++height}`,
    height,
    transfers: [{ from: payer, to: target.address, amount: [] }],
    announcement: { viewTag: target.viewTag, cipherText: target.cipherText },
  };
  return { item, address: target.address };
}

const p1 = payment(payer1);
const p2 = payment(payer2);
const o1 = p1.address;
const o2 = p2.address;

/** The heuristic matches by ID for a view with payments p1 and p2 and the given histories. */
function run(histories: Record<string, SearchedTxWithEvents[]>, items = [p1.item, p2.item]) {
  const view = {
    account,
    publicKey,
    kemPublicKey,
    items,
    suspects: new Set(items.flatMap((item) => item.transfers.map((transfer) => transfer.to))),
    histories: new Map(Object.entries(histories)),
  };
  return Object.fromEntries(linkHeuristics(view).map((h) => [h.id, h.matches.length]));
}

describe("link heuristics", () => {
  test("clean public data gives no match, and a fresh KEM key opens no announcement of A", () => {
    const counts = run({
      [account]: [tx([send(funder, account)]), tx([fee(account)])],
      [o1]: [tx([fee(payer1), send(payer1, o1)]), tx([fee(o1), send(o1, destination1)])],
      [o2]: [tx([fee(payer2), send(payer2, o2)]), tx([fee(o2), send(o2, destination2)])],
    });
    expect(counts).toEqual({ H1: 0, H2: 0, H3: 0, H4: 0, H5: 0, H6: 0, H7: 0, H8: 0, H9: 0 });
  });

  const leaks: [string, () => Record<string, number>][] = [
    ["H1", () => run({ [o1]: [tx([send(o1, destination1)], `memo ${qorToEvm(account).toUpperCase()}`)] })],
    ["H2", () => run({ [o1]: [tx([send(account, o1)])] })],
    ["H3", () => run({ [o1]: [tx([send(o1, account)])] })],
    ["H4", () => run({ [account]: [tx([send(funder, account)])], [o1]: [tx([send(funder, o1)])] })],
    ["H6", () => run({ [o1]: [tx([send(o1, o2)])] })],
    ["H7", () => run({ [o1]: [tx([send(o1, destination1)])], [o2]: [tx([send(o2, destination1)])] })],
    ["H8", () => run({ [o1]: [tx([send(payer1, o1)])], [o2]: [tx([send(payer1, o2)])] })],
    ["H9", () => run({}, [p1.item, { ...p2.item, transfers: p1.item.transfers }])],
  ];
  for (const [id, counts] of leaks) {
    test(`${id} finds its leak`, () => {
      expect(counts()[id]).toBe(1);
    });
  }
});
