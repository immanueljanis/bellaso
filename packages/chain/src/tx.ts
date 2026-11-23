import { decodeTxRaw } from "@cosmjs/proto-signing";
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";

export interface Coin {
  denom: string;
  amount: string;
}

export interface Transfer {
  from: string;
  to: string;
  amount: Coin[];
}

/** A transfer with the index of its MsgSend among all messages of the transaction body. */
export interface IndexedTransfer extends Transfer {
  msgIndex: number;
}

export interface AnnouncementTx {
  /** Every bank MsgSend of the transaction, in message order. */
  transfers: Transfer[];
  /** The `record.note` of every MsgExecuteContract to `contract`, in message order. */
  notes: string[];
}

const utf8 = new TextDecoder();
const MSG_SEND = "/cosmos.bank.v1beta1.MsgSend";

/** The note of one `{"record":{"note":"..."}}` execute message, or "" for any other shape. */
function noteOf(msg: Uint8Array): string {
  try {
    const parsed = JSON.parse(utf8.decode(msg)) as { record?: { note?: unknown } };
    return typeof parsed.record?.note === "string" ? parsed.record.note : "";
  } catch {
    return "";
  }
}

/** Every bank MsgSend of decoded transaction messages, in message order. */
function sendsOf(messages: readonly { typeUrl: string; value: Uint8Array }[]): IndexedTransfer[] {
  return messages.flatMap((m, msgIndex) => {
    if (m.typeUrl !== MSG_SEND) return [];
    const send = MsgSend.decode(m.value);
    return [{ from: send.fromAddress, to: send.toAddress, amount: send.amount.map(({ denom, amount }) => ({ denom, amount })), msgIndex }];
  });
}

/**
 * Reads every bank MsgSend of one encoded transaction (TECH_SPEC section 8.5). The gateway
 * transfer index uses it for method 2.
 */
export function readTransfers(txBytes: Uint8Array): IndexedTransfer[] {
  return sendsOf(decodeTxRaw(txBytes).body.messages);
}

/**
 * Reads the transfers and the announcement records of one encoded transaction (TECH_SPEC
 * section 8.1, step 3.1 and 3.2). The CLI scan, the gateway indexer and the browser use it.
 */
export function readAnnouncementTx(txBytes: Uint8Array, contract: string): AnnouncementTx {
  const { messages } = decodeTxRaw(txBytes).body;
  const transfers = sendsOf(messages).map(({ from, to, amount }) => ({ from, to, amount }));
  const notes = messages
    .filter((m) => m.typeUrl === "/cosmwasm.wasm.v1.MsgExecuteContract")
    .map((m) => MsgExecuteContract.decode(m.value))
    .filter((m) => m.contract === contract)
    .map((m) => noteOf(m.msg));
  return { transfers, notes };
}

export interface SearchedTx {
  hash: string;
  height: number;
  tx: Uint8Array;
}

export interface SearchOptions {
  minHeight?: number;
  page?: number;
  perPage?: number;
}

/** One page of CometBFT `tx_search` for `query`, from `minHeight` on, in height order. */
async function searchTxs(
  rpcUrl: string,
  query: string,
  { minHeight = 0, page = 1, perPage = 100 }: SearchOptions,
): Promise<{ total: number; txs: SearchedTx[] }> {
  const filter = minHeight > 0 ? `${query} AND tx.height>=${minHeight}` : query;
  const url = `${rpcUrl}/tx_search?query=${encodeURIComponent(`"${filter}"`)}&page=${page}&per_page=${perPage}&order_by=%22asc%22`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`tx_search answered ${response.status}`);
  const { result } = (await response.json()) as {
    result: { total_count: string; txs: { hash: string; height: string; tx: string }[] };
  };
  return {
    total: Number(result.total_count),
    txs: result.txs.map((item) => ({
      hash: item.hash,
      height: Number(item.height),
      tx: Uint8Array.from(atob(item.tx), (char) => char.charCodeAt(0)),
    })),
  };
}

/**
 * One page of CometBFT `tx_search` for every transaction that touched `contract`, from
 * `minHeight` on, in height order. The scan reads whole pages, never one derived address.
 */
export function searchContractTxs(rpcUrl: string, contract: string, options: SearchOptions = {}) {
  return searchTxs(rpcUrl, `wasm._contract_address='${contract}'`, options);
}

/**
 * One page of CometBFT `tx_search` for every transaction with a bank MsgSend, from
 * `minHeight` on, in height order (TECH_SPEC section 6). The query names no address
 * (THREAT_MODEL R7). The chain indexes no message event of a failed transaction, so each
 * result succeeded (MEASURED 23 Nov 2026: 46 of 46 results from height 10,600,000 had code 0).
 */
export function searchTransferTxs(rpcUrl: string, options: SearchOptions = {}) {
  return searchTxs(rpcUrl, `message.action='${MSG_SEND}'`, options);
}
