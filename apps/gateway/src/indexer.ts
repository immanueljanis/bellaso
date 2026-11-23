import { decodeAnnouncement, fromRecords } from "@bellaso/core";
import { type SearchedTx, type Transfer, readAnnouncementTx } from "@bellaso/chain";

export interface IndexedAnnouncement {
  txHash: string;
  height: number;
  transfers: Transfer[];
  /** Format v1 bytes (1,570) in base64. The browser checks the length and version again. */
  announcement: string;
}

export type SearchPage = (minHeight: number, page: number) => Promise<{ total: number; txs: SearchedTx[] }>;

const PER_PAGE = 100;
const FRESH_MS = 3_000;

/**
 * The announcement index (TECH_SPEC section 9.4). It pulls new transactions of the contract
 * when a client asks, at most once every 3 seconds, so an idle gateway makes no calls and
 * can sleep. It keeps every valid announcement in memory; the chain is the source of truth,
 * so a restart only rebuilds it. It never opens an announcement: it cannot tell whose it is.
 */
export class AnnouncementIndex {
  readonly items: IndexedAnnouncement[] = [];
  rejected = 0;
  private nextHeight = 0;
  private syncedAt = Number.NEGATIVE_INFINITY;
  private running: Promise<void> | null = null;

  constructor(
    private readonly contract: string,
    private readonly search: SearchPage,
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
        if (this.items.some((known) => known.txHash === item.hash)) continue;
        this.add(item);
        this.nextHeight = Math.max(this.nextHeight, item.height + 1);
      }
      if (page * PER_PAGE >= total || txs.length === 0) break;
    }
    this.syncedAt = this.now();
  }

  private add(item: SearchedTx): void {
    const { transfers, notes } = readAnnouncementTx(item.tx, this.contract);
    if (notes.length === 0) return;
    try {
      const bytes = fromRecords(notes);
      decodeAnnouncement(bytes);
      this.items.push({ txHash: item.hash, height: item.height, transfers, announcement: Buffer.from(bytes).toString("base64") });
    } catch {
      this.rejected++;
    }
  }

  /** Up to `limit` announcements above `after`, in height order, and the height to ask from next. */
  page(after: number, limit: number): { items: IndexedAnnouncement[]; next: number } {
    const items = this.items.filter((item) => item.height > after).slice(0, limit);
    const next = items.length > 0 ? items[items.length - 1]!.height : after;
    return { items, next };
  }
}
