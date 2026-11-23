import { decodeAnnouncement, fromRecords, openAnnouncement, type OpenedPayment, type RecipientKeys } from "@bellaso/core";
import { TESTNET } from "@bellaso/chain";
import { decodeTxRaw } from "@cosmjs/proto-signing";
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import type { Coin } from "./rest";

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

interface SearchPage {
  result: { total_count: string; txs: { hash: string; height: string; tx: string }[] };
}

const PER_PAGE = 100;
const utf8 = new TextDecoder();

/** One page of CometBFT `tx_search` for every transaction that touched `contract`. */
async function searchPage(contract: string, page: number): Promise<SearchPage["result"]> {
  const query = encodeURIComponent(`"wasm._contract_address='${contract}'"`);
  const url = `${TESTNET.rpc}/tx_search?query=${query}&page=${page}&per_page=${PER_PAGE}&order_by=%22asc%22`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`tx_search answered ${response.status}`);
  return ((await response.json()) as SearchPage).result;
}

/**
 * The CLI scan (TECH_SPEC section 8.1, all steps). Reads every transaction of the
 * announcement contract, joins its records in message order, and opens the announcement
 * against each MsgSend destination in the same transaction. It never queries a single
 * derived address (THREAT_MODEL R7).
 */
export async function scanChain(contract: string, keys: RecipientKeys): Promise<ScanResult> {
  const started = performance.now();
  const result: ScanResult = { transactions: 0, announcements: 0, rejected: 0, found: [], millis: 0 };
  for (let page = 1; ; page++) {
    const { total_count, txs } = await searchPage(contract, page);
    for (const item of txs) {
      result.transactions++;
      const body = decodeTxRaw(Uint8Array.from(Buffer.from(item.tx, "base64"))).body;
      const sends = body.messages.filter((m) => m.typeUrl === "/cosmos.bank.v1beta1.MsgSend").map((m) => MsgSend.decode(m.value));
      const notes = body.messages
        .filter((m) => m.typeUrl === "/cosmwasm.wasm.v1.MsgExecuteContract")
        .map((m) => MsgExecuteContract.decode(m.value))
        .filter((m) => m.contract === contract)
        .map((m) => (JSON.parse(utf8.decode(m.msg)) as { record?: { note?: string } }).record?.note ?? "");
      if (notes.length === 0) continue;
      let announcement;
      try {
        announcement = decodeAnnouncement(fromRecords(notes));
      } catch {
        result.rejected++;
        continue;
      }
      result.announcements++;
      for (const send of sends) {
        const opened = openAnnouncement(keys, announcement, send.toAddress);
        if (opened) result.found.push({ ...opened, txHash: item.hash, height: Number(item.height), amount: send.amount });
      }
    }
    if (page * PER_PAGE >= Number(total_count) || txs.length === 0) break;
  }
  result.millis = performance.now() - started;
  return result;
}

/** The announcement contract from ANNOUNCEMENT_CONTRACT or the network constants. */
export function announcementContract(): string {
  return process.env.ANNOUNCEMENT_CONTRACT ?? TESTNET.announcementContract;
}
