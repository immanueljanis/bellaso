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

export interface AnnouncementTx {
  /** Every bank MsgSend of the transaction, in message order. */
  transfers: Transfer[];
  /** The `record.note` of every MsgExecuteContract to `contract`, in message order. */
  notes: string[];
}

const utf8 = new TextDecoder();

/** The note of one `{"record":{"note":"..."}}` execute message, or "" for any other shape. */
function noteOf(msg: Uint8Array): string {
  try {
    const parsed = JSON.parse(utf8.decode(msg)) as { record?: { note?: unknown } };
    return typeof parsed.record?.note === "string" ? parsed.record.note : "";
  } catch {
    return "";
  }
}

/**
 * Reads the transfers and the announcement records of one encoded transaction (TECH_SPEC
 * section 8.1, step 3.1 and 3.2). The CLI scan, the gateway indexer and the browser use it.
 */
export function readAnnouncementTx(txBytes: Uint8Array, contract: string): AnnouncementTx {
  const { messages } = decodeTxRaw(txBytes).body;
  const transfers = messages
    .filter((m) => m.typeUrl === "/cosmos.bank.v1beta1.MsgSend")
    .map((m) => MsgSend.decode(m.value))
    .map((m) => ({ from: m.fromAddress, to: m.toAddress, amount: m.amount.map(({ denom, amount }) => ({ denom, amount })) }));
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

/**
 * One page of CometBFT `tx_search` for every transaction that touched `contract`, from
 * `minHeight` on, in height order. The scan reads whole pages, never one derived address.
 */
export async function searchContractTxs(
  rpcUrl: string,
  contract: string,
  { minHeight = 0, page = 1, perPage = 100 }: { minHeight?: number; page?: number; perPage?: number } = {},
): Promise<{ total: number; txs: SearchedTx[] }> {
  const filter = minHeight > 0 ? `wasm._contract_address='${contract}' AND tx.height>=${minHeight}` : `wasm._contract_address='${contract}'`;
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
