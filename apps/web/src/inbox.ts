import type { Coin, Transfer } from "@bellaso/chain";
import { type RecipientKeys, decodeAnnouncement, openAnnouncement } from "@bellaso/core";
import { GATEWAY_URL } from "./gateway";
import type { InboxPayment, StealthEntry } from "./vault";

/** One item of `GET /v1/announcements` (TECH_SPEC section 9.3). */
export interface GatewayAnnouncement {
  txHash: string;
  height: number;
  transfers: Transfer[];
  announcement: string;
}

/** One item of `GET /v1/transfers` (TECH_SPEC section 9.3, method 2). */
export interface GatewayTransfer {
  txHash: string;
  height: number;
  msgIndex: number;
  from: string;
  to: string;
  amount: Coin[];
}

const PAGE = 500;

const fromBase64 = (text: string) => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

/**
 * Every page of a gateway feed, in height order. The request has no address, so the
 * gateway cannot tell whose inbox asks (THREAT_MODEL R7).
 */
async function readFeed<T extends { height: number }>(path: string): Promise<T[] | null> {
  const all: T[] = [];
  for (let after = 0; ; ) {
    const response = await fetch(`${GATEWAY_URL}${path}?after=${after}&limit=${PAGE}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`The gateway answered ${response.status} for ${path}`);
    const { items } = (await response.json()) as { items: T[] };
    all.push(...items);
    if (items.length < PAGE) return all;
    after = items[items.length - 1]!.height;
  }
}

/** All valid announcements from the gateway. */
export async function fetchAnnouncements(): Promise<GatewayAnnouncement[]> {
  return (await readFeed<GatewayAnnouncement>("/v1/announcements")) ?? [];
}

/** All bank transfers from the gateway, or null while the gateway has no transfer feed. */
export function fetchTransfers(): Promise<GatewayTransfer[] | null> {
  return readFeed<GatewayTransfer>("/v1/transfers");
}

/**
 * Steps 3.3 to 3.5 of TECH_SPEC section 8.1 for one announcement: check the length and the
 * version again, then open it against each transfer destination of the same transaction.
 */
export function openItem(keys: RecipientKeys, item: GatewayAnnouncement): InboxPayment[] {
  let announcement;
  try {
    announcement = decodeAnnouncement(fromBase64(item.announcement));
  } catch {
    return [];
  }
  return item.transfers.flatMap((transfer) =>
    openAnnouncement(keys, announcement, transfer.to)
      ? [{ method: "link" as const, txHash: item.txHash, height: item.height, address: transfer.to, amount: transfer.amount, announcement: item.announcement }]
      : [],
  );
}

/** Method 2 (TECH_SPEC section 8.5): the transfers to the stealth addresses in the vault. */
export function matchStealth(stealth: StealthEntry[], transfers: GatewayTransfer[]): InboxPayment[] {
  const byAddress = new Map(stealth.map((entry) => [entry.address, entry]));
  return transfers.flatMap((transfer) => {
    const entry = byAddress.get(transfer.to);
    return entry
      ? [{ method: "stealth" as const, txHash: transfer.txHash, height: transfer.height, address: transfer.to, amount: transfer.amount, index: entry.index }]
      : [];
  });
}

/** Joins a new scan with the vault list. A payment keeps the spend status that the vault has for it. */
export function mergePayments(known: InboxPayment[], found: InboxPayment[]): InboxPayment[] {
  const spent = new Map(known.map((payment) => [`${payment.txHash}/${payment.address}`, payment.spentTx]));
  return found
    .map((payment) => ({ ...payment, spentTx: spent.get(`${payment.txHash}/${payment.address}`) }))
    .sort((a, b) => b.height - a.height);
}
