import { encodeAnnouncement, toRecords } from "@bellaso/core";
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import { AuthInfo, TxBody, TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";

export const CONTRACT = "qor1contract";
const utf8 = new TextEncoder();

/** An encoded transaction with one MsgSend and one MsgExecuteContract for each note, like a Bellaso payment. */
export function paymentTx(to: string, notes: string[]): Uint8Array {
  const messages = [
    {
      typeUrl: "/cosmos.bank.v1beta1.MsgSend",
      value: MsgSend.encode({ fromAddress: "qor1payer", toAddress: to, amount: [{ denom: "uqor", amount: "150000" }] }).finish(),
    },
    ...notes.map((note) => ({
      typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
      value: MsgExecuteContract.encode({
        sender: "qor1payer",
        contract: CONTRACT,
        msg: utf8.encode(JSON.stringify({ record: { note } })),
        funds: [],
      }).finish(),
    })),
  ];
  const bodyBytes = TxBody.encode(TxBody.fromPartial({ messages })).finish();
  return TxRaw.encode({ bodyBytes, authInfoBytes: AuthInfo.encode(AuthInfo.fromPartial({})).finish(), signatures: [] }).finish();
}

/** The 7 records of a format v1 announcement with a fixed ciphertext. */
export function validNotes(): string[] {
  return toRecords(encodeAnnouncement({ viewTag: 7, cipherText: new Uint8Array(1568).fill(3) }));
}
