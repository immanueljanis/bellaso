import type { Coin } from "@bellaso/chain";
import { encodeAnnouncement, toRecords } from "@bellaso/core";
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import { AuthInfo, TxBody, TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import { type GatewayConfig, readConfig } from "../src/config";

export const CONTRACT = "qor1contract";
const utf8 = new TextEncoder();

/** The default configuration with fake chain endpoints, no sponsor wallet, and the Railway client IP header. */
export const config: GatewayConfig = {
  ...readConfig({}),
  port: 0,
  chainRest: "https://rest.example",
  chainRpc: "https://rpc.example",
  announcementContract: CONTRACT,
  clientIpHeader: "x-real-ip",
};

/** A bank MsgSend from the test payer. */
function sendMsg(to: string, amount: Coin[]) {
  return { typeUrl: "/cosmos.bank.v1beta1.MsgSend", value: MsgSend.encode({ fromAddress: "qor1payer", toAddress: to, amount }).finish() };
}

/** An encoded transaction with `messages` and no signature. */
function encodeTx(messages: { typeUrl: string; value: Uint8Array }[]): Uint8Array {
  const bodyBytes = TxBody.encode(TxBody.fromPartial({ messages })).finish();
  return TxRaw.encode({ bodyBytes, authInfoBytes: AuthInfo.encode(AuthInfo.fromPartial({})).finish(), signatures: [] }).finish();
}

/** An encoded transaction with one MsgSend and one MsgExecuteContract for each note, like a Bellaso payment. */
export function paymentTx(to: string, notes: string[]): Uint8Array {
  return encodeTx([
    sendMsg(to, [{ denom: "uqor", amount: "150000" }]),
    ...notes.map((note) => ({
      typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
      value: MsgExecuteContract.encode({
        sender: "qor1payer",
        contract: CONTRACT,
        msg: utf8.encode(JSON.stringify({ record: { note } })),
        funds: [],
      }).finish(),
    })),
  ]);
}

/** An encoded transaction with one MsgSend for each entry of `amounts`, to `qor1to0`, `qor1to1` and so on. */
export function transferTx(amounts: Coin[][]): Uint8Array {
  return encodeTx(amounts.map((amount, i) => sendMsg(`qor1to${i}`, amount)));
}

/** The 7 records of a format v1 announcement with a fixed ciphertext. */
export function validNotes(): string[] {
  return toRecords(encodeAnnouncement({ viewTag: 7, cipherText: new Uint8Array(1568).fill(3) }));
}
