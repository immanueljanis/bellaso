import { decodeAnnouncement, fromRecords, openAnnouncement, type OpenedPayment, type RecipientKeys } from "@bellaso/core";
import { type Coin, TESTNET, readAnnouncementTx, searchContractTxs } from "@bellaso/chain";

export interface FoundPayment extends OpenedPayment {
  txHash: string;
  height: number;
  amount: Coin[];
}

export interface ScanResult {
  transactions: number;
  announcements: number;
  rejected: number;
  found: FoundPayment[];
  millis: number;
}

/**
 * The CLI scan (TECH_SPEC section 8.1, all steps). Reads every transaction of the
 * announcement contract with `tx_search`, joins its records in message order, and opens
 * the announcement against each MsgSend destination in the same transaction. It never
 * queries a single derived address (THREAT_MODEL R7).
 */
export async function scanChain(contract: string, keys: RecipientKeys): Promise<ScanResult> {
  const started = performance.now();
  const result: ScanResult = { transactions: 0, announcements: 0, rejected: 0, found: [], millis: 0 };
  for (let page = 1; ; page++) {
    const { total, txs } = await searchContractTxs(TESTNET.rpc, contract, { page });
    for (const item of txs) {
      result.transactions++;
      const { transfers, notes } = readAnnouncementTx(item.tx, contract);
      if (notes.length === 0) continue;
      let announcement;
      try {
        announcement = decodeAnnouncement(fromRecords(notes));
      } catch {
        result.rejected++;
        continue;
      }
      result.announcements++;
      for (const transfer of transfers) {
        const opened = openAnnouncement(keys, announcement, transfer.to);
        if (opened) result.found.push({ ...opened, txHash: item.hash, height: item.height, amount: transfer.amount });
      }
    }
    if (page * 100 >= total || txs.length === 0) break;
  }
  result.millis = performance.now() - started;
  return result;
}

/** The announcement contract from ANNOUNCEMENT_CONTRACT or the network constants. */
export function announcementContract(): string {
  return process.env.ANNOUNCEMENT_CONTRACT ?? TESTNET.announcementContract;
}
