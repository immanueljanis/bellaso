import { openAnnouncement } from "@bellaso/core";
import type { SearchedTxWithEvents } from "@bellaso/chain";
import { deriveSealKeys } from "@qorechain/qoreseal";
import { generateMnemonic, qorToEvm } from "@qorechain/sdk";
import type { AnnouncementItem } from "./scan";

export interface Match {
  addresses: string[];
  evidence: string;
}

/**
 * One linking heuristic. Kind "A": each match ties one address to account A. Kind "G2": each
 * match ties payments to each other (THREAT_MODEL G2), not to A. `need` is the number of true
 * payments of A that a match must hold to count in the scoring.
 */
export interface Heuristic {
  id: string;
  title: string;
  kind: "A" | "G2";
  need: number;
  matches: Match[];
}

/** What a third party knows: public chain data and public data of account A, no secret. */
export interface PublicView {
  /** The address of account A. */
  account: string;
  /** `P_A` from the auth account. */
  publicKey: Uint8Array;
  /** `ek_A` from the KEM registry. */
  kemPublicKey: Uint8Array;
  /** The valid announcements of the contract. */
  items: AnnouncementItem[];
  /** The one-time addresses of the announcements and any other suspect address. */
  suspects: Set<string>;
  /** Every transaction with a transfer from or to A or a suspect, by address. */
  histories: Map<string, SearchedTxWithEvents[]>;
}

interface Flow {
  from: string;
  to: string;
  txHash: string;
}

const latin1 = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");
const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

/** The bank transfers that messages made in `txs`. A fee transfer has no `msg_index` attribute, so it is left out. */
function flowsOf(txs: Iterable<SearchedTxWithEvents>): Flow[] {
  const flows: Flow[] = [];
  for (const tx of txs) {
    for (const event of tx.events) {
      if (event.type !== "transfer") continue;
      const attribute = new Map(event.attributes.map(({ key, value }) => [key, value]));
      const from = attribute.get("sender");
      const to = attribute.get("recipient");
      if (from && to && attribute.has("msg_index")) flows.push({ from, to, txHash: tx.hash });
    }
  }
  return flows;
}

/** Groups of two or more distinct values of `member`, keyed by `key`. */
function groups<T>(rows: T[], key: (row: T) => string, member: (row: T) => string): [string, string[]][] {
  const all = new Map<string, Set<string>>();
  for (const row of rows) all.set(key(row), (all.get(key(row)) ?? new Set()).add(member(row)));
  return [...all].filter(([, members]) => members.size > 1).map(([name, members]) => [name, [...members]]);
}

/** Byte and text forms of the public identifiers of A that H1 looks for. Hex forms match in any letter case. */
function identifiersOf({ account, publicKey, kemPublicKey }: PublicView) {
  const accountHex = qorToEvm(account).slice(2);
  return [
    { name: "address of A", text: account, anyCase: false },
    { name: "account bytes of A", text: latin1(Buffer.from(accountHex, "hex")), anyCase: false },
    { name: "EVM address of A", text: accountHex, anyCase: true },
    { name: "P_A", text: latin1(publicKey), anyCase: false },
    { name: "P_A in hex", text: hex(publicKey), anyCase: true },
    { name: "P_A in base64", text: base64(publicKey), anyCase: false },
    { name: "ek_A", text: latin1(kemPublicKey), anyCase: false },
    { name: "ek_A in hex", text: hex(kemPublicKey), anyCase: true },
    { name: "ek_A in base64", text: base64(kemPublicKey), anyCase: false },
  ];
}

/** H1: the identifiers of A in the body, the events or the announcement of a transaction of a suspect. */
function identifierMatches(view: PublicView): Match[] {
  const identifiers = identifiersOf(view);
  const matches: Match[] = [];
  for (const address of view.suspects) {
    const sources = [
      ...(view.histories.get(address) ?? []).flatMap((tx) => [
        { where: `body of tx ${tx.hash}`, text: latin1(tx.tx) },
        { where: `events of tx ${tx.hash}`, text: JSON.stringify(tx.events) },
      ]),
      ...view.items
        .filter((item) => item.transfers.some((transfer) => transfer.to === address))
        .map((item) => ({ where: `announcement of tx ${item.txHash}`, text: latin1(item.announcement.cipherText) })),
    ];
    for (const source of sources) {
      const lower = source.text.toLowerCase();
      const hits = identifiers.filter((id) => (id.anyCase ? lower : source.text).includes(id.text));
      if (hits.length > 0) {
        matches.push({ addresses: [address], evidence: `${address} · ${hits.map((id) => id.name).join(", ")} in the ${source.where}` });
      }
    }
  }
  return matches;
}

/**
 * H5: opens each announcement with `P_A` and a fresh ML-KEM-1024 key, as a third party without
 * `dk_A` can (TECH_SPEC section 12.2, check 2). The third party has no private key and no root
 * secret, so those parts are zero bytes; openAnnouncement reads them only after a match.
 */
function outsiderMatches({ publicKey, items }: PublicView): Match[] {
  const outsider = deriveSealKeys({ mnemonic: generateMnemonic(256), index: 0 });
  const keys = { publicKey, privateKey: new Uint8Array(32), kemSecretKey: outsider.mlkemSecretKey, pqRoot: new Uint8Array(32) };
  return items.flatMap((item) =>
    item.transfers
      .filter((transfer) => openAnnouncement(keys, item.announcement, transfer.to))
      .map((transfer) => ({ addresses: [transfer.to], evidence: `${transfer.to} · tx ${item.txHash}` })),
  );
}

/** Runs every heuristic on public data only. */
export function linkHeuristics(view: PublicView): Heuristic[] {
  const { account, suspects } = view;
  const known = new Map([...view.histories.values()].flat().map((tx) => [tx.hash, tx]));
  const flows = flowsOf(known.values());
  const fundersOfA = new Set(flows.filter((flow) => flow.to === account).map((flow) => flow.from));
  const fromSuspect = flows.filter((flow) => suspects.has(flow.from));
  const toSuspect = flows.filter((flow) => suspects.has(flow.to));
  const flowMatch = (flow: Flow, note: string, addresses: string[]): Match => ({ addresses, evidence: `${note} · tx ${flow.txHash}` });
  const destinations = view.items.flatMap((item) => item.transfers.map((transfer) => ({ to: transfer.to, txHash: item.txHash })));

  return [
    { id: "H1", title: "identifiers of A in a transaction of a one-time address", kind: "A", need: 1, matches: identifierMatches(view) },
    {
      id: "H2",
      title: "transfer from A to a one-time address",
      kind: "A",
      need: 1,
      matches: toSuspect.filter((flow) => flow.from === account).map((flow) => flowMatch(flow, `A paid ${flow.to}`, [flow.to])),
    },
    {
      id: "H3",
      title: "transfer from a one-time address to A",
      kind: "A",
      need: 1,
      matches: fromSuspect.filter((flow) => flow.to === account).map((flow) => flowMatch(flow, `${flow.from} paid A`, [flow.from])),
    },
    {
      id: "H4",
      title: "a funder of A also funded a one-time address",
      kind: "A",
      need: 1,
      matches: toSuspect
        .filter((flow) => flow.from !== account && fundersOfA.has(flow.from))
        .map((flow) => flowMatch(flow, `${flow.to} funded by ${flow.from}, which also funded A`, [flow.to])),
    },
    { id: "H5", title: "open each announcement with P_A and a fresh KEM key", kind: "A", need: 1, matches: outsiderMatches(view) },
    {
      id: "H6",
      title: "transfer from one one-time address to another",
      kind: "G2",
      need: 2,
      matches: fromSuspect
        .filter((flow) => suspects.has(flow.to) && flow.to !== flow.from)
        .map((flow) => flowMatch(flow, `${flow.from} paid ${flow.to}`, [flow.from, flow.to])),
    },
    {
      id: "H7",
      title: "one-time addresses that paid the same destination",
      kind: "G2",
      need: 2,
      matches: groups(fromSuspect, (flow) => flow.to, (flow) => flow.from).map(([to, from]) => ({
        addresses: from,
        evidence: `${from.join(", ")} all paid ${to}`,
      })),
    },
    {
      id: "H8",
      title: "one funder paid more than one one-time address",
      kind: "G2",
      need: 2,
      matches: groups(toSuspect, (flow) => flow.from, (flow) => flow.to).map(([from, to]) => ({
        addresses: to,
        evidence: `${from} paid ${to.join(", ")}`,
      })),
    },
    {
      id: "H9",
      title: "one one-time address in more than one announcement",
      kind: "G2",
      need: 1,
      matches: groups(destinations, (row) => row.to, (row) => row.txHash).map(([to, hashes]) => ({
        addresses: [to],
        evidence: `${to} in txs ${hashes.join(", ")}`,
      })),
    },
  ];
}
