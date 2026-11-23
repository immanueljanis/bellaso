import { expect, test } from "bun:test";
import { TESTNET } from "@bellaso/chain";
import { type RestTx, describeTx } from "../src/tx-view";

const PAYER = "qor1esra9lc9weq7js4x9ay4744fymfyqex5utra3s";
const ONE_TIME = "qor1d6vu99v374gqchejppkt0e9u6ealz5xykpkdtj";
const FUSD = "erc20:0x97143B771D34ddb9130b807b135Ae675A5a963CA";

/** A transaction in the REST shape, with the messages and events given. Based on tx CB4CF5BE…7679 of 23 Nov 2026. */
function restTx(messages: RestTx["tx"]["body"]["messages"], events: RestTx["tx_response"]["events"]): RestTx {
  return {
    tx: { body: { messages }, auth_info: { fee: { amount: [{ denom: "uqor", amount: "457233" }] } } },
    tx_response: { txhash: "CB4CF5BE", height: "10619003", code: 0, timestamp: "2026-11-23T14:22:23Z", gas_used: "3048220", events },
  };
}

const send = { "@type": "/cosmos.bank.v1beta1.MsgSend", from_address: PAYER, to_address: ONE_TIME, amount: [{ denom: FUSD, amount: "10000000" }] };
const record = (contract: string) => ({ "@type": "/cosmwasm.wasm.v1.MsgExecuteContract", sender: PAYER, contract, msg: '{"record":{"note":"x"}}' });
const hybridEvent = (status: string) => ({ type: "pqc_hybrid_verify", attributes: [{ key: "status", value: status }] });

test("describeTx reads a method 1 payment: the transfer, the records and the hybrid signature", () => {
  const view = describeTx(restTx([send, record(TESTNET.announcementContract), record(TESTNET.announcementContract)], [hybridEvent("verified")]));
  expect(view.kind).toBe("payment");
  expect(view.records).toBe(2);
  expect(view.transfers).toEqual([{ from: PAYER, to: ONE_TIME, amount: [{ denom: FUSD, amount: "10000000" }] }]);
  expect(view.hybrid).toBe(true);
  expect(view.height).toBe(10619003);
});

test("describeTx counts only records to the Bellaso contract, and a transfer with other records is not a payment", () => {
  const view = describeTx(restTx([send, record("qor1other")], []));
  expect(view.records).toBe(0);
  expect(view.kind).toBe("other");
  expect(view.hybrid).toBe(false);
});

test("describeTx names transfers and key registrations, and needs status verified for hybrid", () => {
  expect(describeTx(restTx([send], [hybridEvent("failed")]))).toMatchObject({ kind: "transfer", hybrid: false });
  expect(describeTx(restTx([{ "@type": "/qorechain.pqc.v1.MsgRegisterPQCKeyV2" }], [])).kind).toBe("signing-key");
  expect(describeTx(restTx([{ "@type": "/qorechain.pqc.v1.MsgRegisterKEMKey" }], [])).kind).toBe("kem-key");
});
