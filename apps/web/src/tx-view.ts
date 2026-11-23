import { type Coin, TESTNET, type Transfer } from "@bellaso/chain";

/** One transaction as the REST route `/cosmos/tx/v1beta1/txs/{hash}` returns it: only the fields the page reads. */
export interface RestTx {
  tx: {
    body: { messages: ({ "@type": string } & Record<string, unknown>)[] };
    auth_info: { fee: { amount: Coin[] } };
  };
  tx_response: {
    txhash: string;
    height: string;
    code: number;
    timestamp: string;
    gas_used: string;
    events: { type: string; attributes: { key: string; value: string }[] }[];
  };
}

/** What the transaction does, for the page title. A payment is a transfer plus announcement records. */
export type TxKind = "payment" | "transfer" | "signing-key" | "kem-key" | "other";

export interface TxView {
  hash: string;
  code: number;
  height: number;
  time: string;
  kind: TxKind;
  transfers: Transfer[];
  /** The announcement records to the Bellaso contract (7 for one method 1 payment). */
  records: number;
  /** True when the chain emitted `pqc_hybrid_verify` with status `verified`: it checked secp256k1 and ML-DSA-87. */
  hybrid: boolean;
  fee: Coin[];
  gasUsed: number;
}

const MSG_SEND = "/cosmos.bank.v1beta1.MsgSend";
const KEY_MESSAGES: Record<string, TxKind> = {
  "/qorechain.pqc.v1.MsgRegisterPQCKeyV2": "signing-key",
  "/qorechain.pqc.v1.MsgRegisterKEMKey": "kem-key",
};

const isRecord = (message: RestTx["tx"]["body"]["messages"][number]) =>
  message["@type"] === "/cosmwasm.wasm.v1.MsgExecuteContract" && message.contract === TESTNET.announcementContract;

/** The readable view of one REST transaction. */
export function describeTx({ tx, tx_response: response }: RestTx): TxView {
  const { messages } = tx.body;
  const transfers = messages
    .filter((message) => message["@type"] === MSG_SEND)
    .map((message) => ({ from: String(message.from_address), to: String(message.to_address), amount: message.amount as Coin[] }));
  const records = messages.filter(isRecord).length;
  const keyKind = messages.map((message) => KEY_MESSAGES[message["@type"]]).find(Boolean);
  const onlyTransfers = transfers.length > 0 && transfers.length === messages.length;
  const kind: TxKind = records > 0 && transfers.length > 0 ? "payment" : (keyKind ?? (onlyTransfers ? "transfer" : "other"));
  const hybrid = response.events.some(
    (event) => event.type === "pqc_hybrid_verify" && event.attributes.some(({ key, value }) => key === "status" && value === "verified"),
  );
  return {
    hash: response.txhash,
    code: response.code,
    height: Number(response.height),
    time: response.timestamp,
    kind,
    transfers,
    records,
    hybrid,
    fee: tx.auth_info.fee.amount,
    gasUsed: Number(response.gas_used),
  };
}
