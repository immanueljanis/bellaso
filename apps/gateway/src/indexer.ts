import { decodeAnnouncement, fromRecords } from "@bellaso/core";
import { type IndexedTransfer, type SearchedTx, type Transfer, TESTNET, readAnnouncementTx, readTransfers } from "@bellaso/chain";

export interface IndexedAnnouncement {
  txHash: string;
  height: number;
  transfers: Transfer[];
  /** Format v1 bytes (1,570) in base64. The browser checks the length and version again. */
  announcement: string;
}

/** One bank transfer of QOR, fUSD, fETH or fBTC (TECH_SPEC section 9.3, `/v1/transfers`). */
export interface TransferItem extends IndexedTransfer {
  txHash: string;
  height: number;
}

export type SearchPage = (minHeight: number, page: number) => Promise<{ total: number; txs: SearchedTx[] }>;

const PER_PAGE = 100;
const FRESH_MS = 3_000;

/**
 * An index of chain transactions (TECH_SPEC section 9.4). It pulls new transactions when a
 * client asks, at most once every 3 seconds, so an idle gateway makes no calls and can sleep.
 * It keeps its items in memory, in height order; the chain is the source of truth, so a
 * restart only rebuilds it. `read` turns one transaction into items. A transaction that
 * `read` throws on counts as rejected (THREAT_MODEL R16).
 */
export class TxIndex<T extends { txHash: string; height: number }> {
  readonly items: T[] = [];
  rejected = 0;
  private readonly seen = new Set<string>();
  private syncedAt = Number.NEGATIVE_INFINITY;
  private running: Promise<void> | null = null;

  constructor(
    private readonly search: SearchPage,
    private readonly read: (item: SearchedTx) => T[],
    private nextHeight: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Pulls the transactions after the last indexed height, unless the index is fresh. */
  async sync(): Promise<void> {
    if (this.now() - this.syncedAt < FRESH_MS) return;
    this.running ??= this.pull().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async pull(): Promise<void> {
    const from = this.nextHeight;
    for (let page = 1; ; page++) {
      const { total, txs } = await this.search(from, page);
      for (const item of txs) {
        if (this.seen.has(item.hash)) continue;
        this.seen.add(item.hash);
        try {
          this.items.push(...this.read(item));
        } catch {
          this.rejected++;
        }
        this.nextHeight = Math.max(this.nextHeight, item.height + 1);
      }
      if (page * PER_PAGE >= total || txs.length === 0) break;
    }
    this.syncedAt = this.now();
  }

  /**
   * Up to `limit` items above `after`, in height order, and the height to ask from next.
   * A page keeps every item of its last height, so it can pass `limit` by the rest of that
   * height. Thus a client that asks again with `after=next` misses no item.
   */
  page(after: number, limit: number): { items: T[]; next: number } {
    const later = this.items.filter((item) => item.height > after);
    let end = Math.min(limit, later.length);
    while (end > 0 && end < later.length && later[end]!.height === later[end - 1]!.height) end++;
    const items = later.slice(0, end);
    const next = items.length > 0 ? items[items.length - 1]!.height : after;
    return { items, next };
  }
}

/** The announcement of one transaction, or none when it has no records. Throws on a broken record set. */
function announcementOf(item: SearchedTx, contract: string): IndexedAnnouncement[] {
  const { transfers, notes } = readAnnouncementTx(item.tx, contract);
  if (notes.length === 0) return [];
  const bytes = fromRecords(notes);
  decodeAnnouncement(bytes);
  return [{ txHash: item.hash, height: item.height, transfers, announcement: Buffer.from(bytes).toString("base64") }];
}

/**
 * The announcement index: every valid announcement of the contract, from height 0. It never
 * opens an announcement: it cannot tell whose it is.
 */
export class AnnouncementIndex extends TxIndex<IndexedAnnouncement> {
  constructor(contract: string, search: SearchPage, now?: () => number) {
    super(search, (item) => announcementOf(item, contract), 0, now);
  }
}

const TRANSFER_DENOMS = new Set<string>(Object.values(TESTNET.denoms).map((coin) => coin.denom));

/** The transfers of one transaction that move QOR, fUSD, fETH or fBTC. */
function transfersOf(item: SearchedTx): TransferItem[] {
  return readTransfers(item.tx)
    .filter((transfer) => transfer.amount.some((coin) => TRANSFER_DENOMS.has(coin.denom)))
    .map(({ msgIndex, from, to, amount }) => ({ txHash: item.hash, height: item.height, msgIndex, from, to, amount }));
}

/**
 * The transfer index for method 2 (TECH_SPEC section 8.5): every MsgSend of the four test
 * denoms from `fromHeight` on. It keeps every transfer and has no address filter, so the
 * gateway cannot tell which stealth address a client looks for (THREAT_MODEL R7).
 */
export class TransferIndex extends TxIndex<TransferItem> {
  constructor(search: SearchPage, fromHeight: number, now?: () => number) {
    super(search, transfersOf, fromHeight, now);
  }
}
