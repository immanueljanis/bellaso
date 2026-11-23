import { encodeAnnouncement, makePaymentTarget, toRecords, type PaymentTarget } from "@bellaso/core";
import { TESTNET } from "@bellaso/chain";
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import type { RecipientPublicData } from "./gateway";
import type { QorexEncodedMessage } from "./qorex";

/** QOR that rides with each payment so the recipient can spend it (TECH_SPEC section 7.3; G5 measured 0.093 QOR). */
export const GAS_ALLOWANCE_UQOR = 150_000n;

/**
 * Gas hint for MsgSend + 7 records (gate G3 used 817,224 gas). QoreX 0.4 ignores it for
 * contract messages: it simulates and asks for the simulation × 1.3 (gate G4 asked for
 * 3,046,888 gas and used 838,445).
 */
export const PAYMENT_GAS_LIMIT = 1_200_000;

/** The network fee QoreX charged for one payment in gate G4 (457,034 uqor). The chain charges the gas limit, not the gas used. */
export const QOREX_PAYMENT_FEE_QOR = 0.46;

const utf8 = new TextEncoder();

export interface PaymentPlan {
  target: PaymentTarget;
  recordCount: number;
  messages: QorexEncodedMessage[];
}

/**
 * Method 1, payer side, in the browser: seals a secret to the recipient's ML-KEM-1024 key,
 * derives the one-time address, and builds one MsgSend (token + gas allowance) plus one
 * MsgExecuteContract for each announcement record. Coins are sorted by denom, as the
 * chain requires.
 */
export function planPayment(payer: string, recipient: RecipientPublicData, denom: string, amount: bigint): PaymentPlan {
  const target = makePaymentTarget(recipient.publicKey, recipient.kemPublicKey);
  const records = toRecords(encodeAnnouncement(target));
  const coins = [
    { denom, amount: amount.toString() },
    { denom: TESTNET.denoms.QOR.denom, amount: GAS_ALLOWANCE_UQOR.toString() },
  ].sort((a, b) => (a.denom < b.denom ? -1 : 1));
  const send: QorexEncodedMessage = {
    typeUrl: "/cosmos.bank.v1beta1.MsgSend",
    value: MsgSend.encode({ fromAddress: payer, toAddress: target.address, amount: coins }).finish(),
  };
  const notes = records.map<QorexEncodedMessage>((note) => ({
    typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
    value: MsgExecuteContract.encode({
      sender: payer,
      contract: TESTNET.announcementContract,
      msg: utf8.encode(JSON.stringify({ record: { note } })),
      funds: [],
    }).finish(),
  }));
  return { target, recordCount: records.length, messages: [send, ...notes] };
}
