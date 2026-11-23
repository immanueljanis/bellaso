import {
  type Announcement,
  type OpenedPayment,
  type RecipientKeys,
  decodeAnnouncement,
  fromRecords,
  openAnnouncement,
} from "@bellaso/core";
import {
  type Coin,
  type SearchedTx,
  type SearchedTxWithEvents,
  type Transfer,
  TESTNET,
  readAnnouncementTx,
  searchContractTxs,
} from "@bellaso/chain";

/** One valid announcement and the transfers of its transaction (TECH_SPEC section 8.1, steps 3.1 to 3.3). */
export interface AnnouncementItem {
  txHash: string;
  height: number;
  transfers: Transfer[];
  announcement: Announcement;
}

export interface AnnouncementSet {
  items: AnnouncementItem[];
  /** Record sets with a bad header, length or version. */
  rejected: number;
}

export interface FoundPayment extends OpenedPayment {
  txHash: string;
  height: number;
  amount: Coin[];
}

/** Reads every page of a paged `tx_search`. */
export async function allPages<T>(search: (page: number) => Promise<{ total: number; txs: T[] }>, perPage = 100): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; ; page++) {
    const { total, txs } = await search(page);
    all.push(...txs);
    if (page * perPage >= total || txs.length === 0) return all;
  }
}

/**
 * Every transaction of the announcement contract, read with `tx_search` on the chain. It
 * reads whole pages and never queries a single derived address (THREAT_MODEL R7).
 */
export function contractTxs(contract: string): Promise<SearchedTxWithEvents[]> {
  return allPages((page) => searchContractTxs(TESTNET.rpc, contract, { page }));
}

/** Joins the records of each transaction in message order and keeps the valid announcements (steps 3.1 to 3.3). */
export function announcementsOf(txs: SearchedTx[], contract: string): AnnouncementSet {
  const set: AnnouncementSet = { items: [], rejected: 0 };
  for (const item of txs) {
    const { transfers, notes } = readAnnouncementTx(item.tx, contract);
    if (notes.length === 0) continue;
    try {
      set.items.push({ txHash: item.hash, height: item.height, transfers, announcement: decodeAnnouncement(fromRecords(notes)) });
    } catch {
      set.rejected++;
    }
  }
  return set;
}

interface GatewayPage {
  items: { txHash: string; height: number; transfers: Transfer[]; announcement: string }[];
  next: number;
  rejected: number;
}

/**
 * Every announcement that the gateway serves, from all pages of `/v1/announcements`. The
 * gateway did steps 3.1 to 3.3; this checks the length and the version again, as the
 * browser does. An item that fails the check counts as rejected.
 */
export async function gatewayAnnouncements(gatewayUrl: string): Promise<AnnouncementSet> {
  const items: AnnouncementItem[] = [];
  let localRejected = 0;
  for (let after = 0; ; ) {
    const response = await fetch(`${gatewayUrl}/v1/announcements?after=${after}`);
    if (!response.ok) throw new Error(`Gateway /v1/announcements answered ${response.status}`);
    const page = (await response.json()) as GatewayPage;
    for (const item of page.items) {
      try {
        const announcement = decodeAnnouncement(new Uint8Array(Buffer.from(item.announcement, "base64")));
        items.push({ txHash: item.txHash, height: item.height, transfers: item.transfers, announcement });
      } catch {
        localRejected++;
      }
    }
    if (page.items.length === 0 || page.next <= after) return { items, rejected: page.rejected + localRejected };
    after = page.next;
  }
}

/** Opens each announcement against each transfer destination of the same transaction (steps 3.4 and 3.5). */
export function openPayments(keys: RecipientKeys, items: AnnouncementItem[]): FoundPayment[] {
  return items.flatMap((item) =>
    item.transfers.flatMap((transfer) => {
      const opened = openAnnouncement(keys, item.announcement, transfer.to);
      return opened ? [{ ...opened, txHash: item.txHash, height: item.height, amount: transfer.amount }] : [];
    }),
  );
}

/** The CLI scan (TECH_SPEC section 8.1, all steps) on the chain, without the gateway. */
export async function scanChain(contract: string, keys: RecipientKeys): Promise<FoundPayment[]> {
  return openPayments(keys, announcementsOf(await contractTxs(contract), contract).items);
}

/** The announcement contract from ANNOUNCEMENT_CONTRACT or the network constants. */
export function announcementContract(): string {
  return process.env.ANNOUNCEMENT_CONTRACT ?? TESTNET.announcementContract;
}
